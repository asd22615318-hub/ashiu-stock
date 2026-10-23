"""Daily cash indices and unadjusted TX nearest-month full-session history (night belongs to the following trading date)."""
import csv,io,json,urllib.request,urllib.parse,datetime as dt,concurrent.futures,calendar
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def get(url,body=None):
    request=urllib.request.Request(url,data=urllib.parse.urlencode(body).encode() if body else None,headers={'User-Agent':'Mozilla/5.0'})
    return urllib.request.urlopen(request,timeout=45).read()
def month(year,mon,today):
    end=min(dt.date(year,mon,calendar.monthrange(year,mon)[1]),today)
    data=get('https://www.taifex.com.tw/cht/3/futDataDown',dict(down_type='1',commodity_id='TX',commodity_id2='',queryStartDate=f'{year}/{mon:02}/01',queryEndDate=end.strftime('%Y/%m/%d'))).decode('cp950')
    contracts={}
    for r in csv.reader(io.StringIO(data)):
        if len(r)<18 or r[1].strip()!='TX' or r[17].strip() not in ('一般','盤後') or not r[2].strip().isdigit() or len(r[2].strip())!=6:continue
        try:
            close=float(r[6]);contract=r[2].strip();date=r[0].replace('/','-')
            bar=dict(open=float(r[3]),high=float(r[4]),low=float(r[5]),close=close,volume=float(r[9]))
        except ValueError:continue
        if close<=0:continue
        contracts.setdefault(date,{}).setdefault(contract,{})[r[17].strip()]=bar
    result=[]
    for date,choices in contracts.items():
        contract=min(choices);sessions=choices[contract];day=sessions.get('一般');night=sessions.get('盤後');last=day or night
        result.append(dict(date=date,contract=contract,open=(night or day)['open'],high=max(x['high'] for x in sessions.values()),low=min(x['low'] for x in sessions.values()),close=last['close'],volume=sum(x['volume'] for x in sessions.values()),session='日夜盤完成' if day and night else '日盤完成（無夜盤資料）' if day else '夜盤完成／日盤待更新',night_close=night['close'] if night else None))
    return result
def cash(symbol):
    data=json.loads(get('https://query1.finance.yahoo.com/v8/finance/chart/'+urllib.parse.quote(symbol,safe='')+'?range=2y&interval=1d'))['chart']['result'][0]
    close=data['indicators']['quote'][0]['close'];zone=dt.timezone(dt.timedelta(hours=8))
    return [{'date':dt.datetime.fromtimestamp(t,zone).date().isoformat(),'close':c} for t,c in zip(data['timestamp'],close) if c is not None and c>0]
def update():
    today=dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date();target=ROOT/'market-overview-seed.json'
    old=json.loads(target.read_text(encoding='utf-8')) if target.exists() else {'items':[]};saved={x['code']:x for x in old['items']}
    items=[]
    for code,name,symbol in [('TWII','加權指數','^TWII')]:
        try:bars=cash(symbol);assert len(bars)>=361;items.append(dict(code=code,name=name,bars=bars,source='Yahoo Finance 日線',url='https://finance.yahoo.com/quote/'+urllib.parse.quote(symbol,safe='')+'/history/'))
        except Exception as e:
            if code in saved:items.append(saved[code])
            else:items.append(dict(code=code,name=name,bars=[],error=str(e)))
    bars={b['date']:b for b in saved.get('TX',{}).get('bars',[]) if 'session' in b};months=[]
    for offset in range(23,-1,-1):
        total=today.year*12+today.month-1-offset;y,m=divmod(total,12)
        if bars and offset>1:continue
        months.append((y,m+1))
    errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs={pool.submit(month,y,m,today):(y,m) for y,m in months}
        for job in concurrent.futures.as_completed(jobs):
            try:
                for bar in job.result():bars[bar['date']]=bar
            except Exception as e:errors.append(str(e))
    items.insert(0,dict(code='TX',name='台指近全',bars=sorted(bars.values(),key=lambda b:b['date']),source='期交所日盤＋夜盤；依官方交易日合併，夜盤歸次一交易日，日盤完成後以日盤收盤計分；最近月未還原串接',url='https://www.taifex.com.tw/cht/3/futDailyMarketReport',errors=errors))
    otc={b['date']:b for b in saved.get('TWO',{}).get('bars',[])}
    def otcmonth(offset):
        total=today.year*12+today.month-1-offset;y,m=divmod(total,12)
        data=json.loads(get(f'https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingIndex?date={y}/{m+1:02}/01&response=json'))
        result=[]
        for row in data['tables'][0]['data']:
            year,mon,day=map(int,row[0].split('/'));result.append({'date':f'{year+1911:04}-{mon:02}-{day:02}','close':float(row[4])})
        return result
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(otcmonth,range(2 if otc else 24)):
            for b in result:otc[b['date']]=b
    items.append(dict(code='TWO',name='櫃買指數',bars=sorted(otc.values(),key=lambda b:b['date']),source='櫃買中心日成交量值、指數',url='https://www.tpex.org.tw/zh-tw/mainboard/trading/info/daily-indices.html'))
    try:
        payload=dict(MarketType='1',SymbolType='F',KindID='1',CID='TXF',ExpireMonth='',RowSize='全部',PageNo='',SortColumn='',AscDesc='A')
        request=urllib.request.Request('https://mis.taifex.com.tw/futures/api/getQuoteList',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','User-Agent':'Mozilla/5.0'})
        quotes=json.load(urllib.request.urlopen(request,timeout=30))['RtData']['QuoteList']
        quote=next(q for q in quotes if q.get('CLastPrice') and q.get('SymbolID','').startswith('TXF') and q.get('SymbolID')!='TXF-P')
        items[0]['latest_quote']=dict(price=float(quote['CLastPrice']),change=float(quote['CDiff']),change_pct=float(quote['CDiffRate']),source_date=quote['CDate'],source_time=quote['CTime'],symbol=quote['SymbolID'],name=quote['DispCName'],status=quote.get('Status'),retrieved_at=dt.datetime.now(dt.timezone.utc).isoformat(),source='期交所行情資訊網站（夜盤）')
    except Exception as e:items[0]['quote_error']=str(e)
    target.write_text(json.dumps(dict(version=1,updated_at=dt.datetime.now(dt.timezone.utc).isoformat(),items=items),ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print([(x['name'],len(x['bars']),x['bars'][-1]['date'] if x['bars'] else x.get('error')) for x in items])
if __name__=='__main__':update()
"""Official Taiwan closing quotes. No credentials or third-party dependencies."""
import argparse
import concurrent.futures
import datetime as dt
import functools
import http.server
import http.client
import json
import math
import os
from pathlib import Path
import re
import threading
import time
import urllib.parse
import urllib.request
import contextlib
import msvcrt
import html

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'dist'
SNAPSHOT = PUBLIC / 'market-data.json'
CACHE = ROOT / '.market-cache'
THREAD_LOCK = threading.RLock()
@contextlib.contextmanager
def snapshot_lock():
    with THREAD_LOCK:
        with (ROOT / '.snapshot.lock').open('a+b') as handle:
            handle.seek(0,2)
            if handle.tell()==0:handle.write(b'0');handle.flush()
            while True:
                try:
                    handle.seek(0);msvcrt.locking(handle.fileno(),msvcrt.LK_NBLCK,1);break
                except OSError:time.sleep(.1)
            try:yield
            finally:handle.seek(0);msvcrt.locking(handle.fileno(),msvcrt.LK_UNLCK,1)
URLS = {
 'listed': 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
 'listed_daily': 'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?type=ALLBUT0999&response=json',
 'otc': 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes',
 'listed_names': 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L',
 'otc_names': 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O',
}

def get_json(url):
    request = urllib.request.Request(url, headers={'User-Agent':'AshiuPatternScreener/1.0','Accept':'application/json'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                try:body=response.read()
                except http.client.IncompleteRead as error:body=error.partial
                # Only accept a syntactically complete JSON response; truncated JSON retries.
                return json.loads(body)
        except Exception:
            if attempt==2:raise
            time.sleep(2*(attempt+1))

def number(value):
    try:
        v=float(str(value).strip().replace(',',''))
        return v if math.isfinite(v) else None
    except (ValueError,TypeError):
        return None

def date_iso(value):
    s=re.sub(r'[^0-9]','',str(value))
    if len(s)==7:s=str(int(s[:3])+1911)+s[3:]
    if len(s)!=8:raise ValueError('Invalid date')
    return dt.date(int(s[:4]),int(s[4:6]),int(s[6:])).isoformat()

def valid_bar(b):
    return all(b.get(k) is not None and b[k]>0 for k in ['open','high','low','close']) and b.get('volume') is not None and b['volume']>=0 and b['low']<=min(b['open'],b['close'])<=max(b['open'],b['close'])<=b['high']

def atomic_json(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp')
    temp.write_text(json.dumps(value,ensure_ascii=False,allow_nan=False,separators=(',',':')),encoding='utf-8')
    os.replace(temp,path)

def read_snapshot():
    if not SNAPSHOT.exists():return {'stocks':[]}
    return json.loads(SNAPSHOT.read_text(encoding='utf-8'))

def get_industries():
    result={}
    for mode in [2,4]:
        request=urllib.request.Request(f'https://isin.twse.com.tw/isin/C_public.jsp?strMode={mode}',headers={'User-Agent':'AshiuPatternScreener/1.0'})
        with urllib.request.urlopen(request,timeout=35) as response:page=response.read().decode('cp950')
        entries={}
        for row in re.findall(r'<tr\b.*?</tr>',page,re.S|re.I):
            cells=[html.unescape(re.sub(r'<[^>]*>','',v)).strip() for v in re.findall(r'<td\b[^>]*>(.*?)</td>',row,re.S|re.I)]
            if len(cells)<6 or not cells[4]:continue
            code=cells[0].split()[0]
            if re.fullmatch(r'\d{4}',code):entries[code]=cells[4]
        if len(entries)<100:raise ValueError('Industry source incomplete')
        result.update(entries)
    atomic_json(CACHE/'industries.json',result)
    return result

def listed_daily_rows(payload):
    if payload.get('stat')!='OK':raise ValueError('TWSE daily report unavailable')
    quote_date=date_iso(payload.get('date'))
    table=next((t for t in payload.get('tables',[]) if '證券代號' in t.get('fields',[])),None)
    if not table:raise ValueError('TWSE daily report missing price table')
    rows=[]
    for values in table.get('data',[]):
        r=dict(zip(table['fields'],values))
        change=number(r.get('漲跌價差'))
        if change is not None and '-' in r.get('漲跌(+/-)',''):change=-change
        rows.append({'Date':quote_date,'Code':r['證券代號'],'Name':r['證券名稱'],
            'TradeVolume':r['成交股數'],'TradeValue':r.get('成交金額'),'OpeningPrice':r['開盤價'],
            'HighestPrice':r['最高價'],'LowestPrice':r['最低價'],'ClosingPrice':r['收盤價'],'Change':change})
    if len(rows)<100:raise ValueError('TWSE daily report incomplete')
    return rows


def update():
    with snapshot_lock():
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            futures={k:pool.submit(get_json,u) for k,u in URLS.items()}
            data={k:f.result() for k,f in futures.items()}
        data['listed_daily']=listed_daily_rows(data['listed_daily'])
        if not all(isinstance(v,list) and v for v in data.values()):raise ValueError('Official source returned an empty or invalid response; previous snapshot kept.')
        listed_api_date=max(date_iso(r['Date']) for r in data['listed'])
        listed_daily_date=max(date_iso(r['Date']) for r in data['listed_daily'])
        listed_source='listed_daily' if listed_daily_date>=listed_api_date else 'listed'
        data['listed']=data[listed_source]
        listed={str(r['公司代號']).strip() for r in data['listed_names']}
        otc={str(r['SecuritiesCompanyCode']).strip() for r in data['otc_names']}
        previous=read_snapshot()
        old={s['code']:s for s in previous['stocks']}
        try:industries=get_industries()
        except Exception:industries={code:s.get('industry','未分類') for code,s in old.items()}
        stocks=[]
        counts={}
        for source,allowed,market in [('listed',listed,'上市'),('otc',otc,'上櫃')]:
            count=0
            for r in data[source]:
                is_listed=source=='listed'
                code=str(r.get('Code') if is_listed else r.get('SecuritiesCompanyCode')).strip()
                if code not in allowed:continue
                b={'date':date_iso(r['Date'])}
                for key,field in [('open','OpeningPrice'),('high','HighestPrice'),('low','LowestPrice'),('close','ClosingPrice')]:
                    b[key]=number(r[field] if is_listed else r[key.title()])
                shares=number(r['TradeVolume'] if is_listed else r['TradingShares'])
                b['volume']=shares/1000 if shares is not None else None
                amount=number(r.get('TradeValue') if is_listed else r.get('TradingAmount'))
                if amount is not None and amount>=0:b['amount']=amount
                change=number(r.get('Change'))
                if change is not None and b['close'] is not None and b['close']-change>0:b['quote_change_pct']=100*change/(b['close']-change)
                if not valid_bar(b):continue
                prior=old.get(code,{})
                if prior.get('bars') and prior['bars'][-1]['date']>b['date']:
                    stocks.append(prior);count+=1;continue
                merged={v['date']:v for v in prior.get('bars',[]) if v['date']<=b['date']}
                # Latest official quote takes precedence over cached historical data.
                if 'amount' not in b and b['date'] in merged and 'amount' in merged[b['date']]:
                    b['amount']=merged[b['date']]['amount']
                merged[b['date']]=b
                bars=[merged[k] for k in sorted(merged)][-520:]
                stocks.append({'code':code,'name':str(r['Name'] if is_listed else r['CompanyName']).strip(),'market':market,'bars':bars,'source':listed_source if is_listed else source,'industry':industries.get(code,'未分類')})
                count+=1
            if count<50:raise ValueError('Too few valid official stock rows; previous snapshot kept.')
            counts[market]=count
        now=dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat(timespec='seconds')
        result={'source':'TWSE daily closing report / TWSE and TPEx OpenAPI','updated_at':now,'sources':URLS,'counts':counts,'stocks':stocks}
        if previous.get('history_backfill'):
            result['history_backfill']=previous['history_backfill']
            result['history_backfill']['history_ready']=sum(len(s['bars'])>=361 for s in stocks)
        atomic_json(SNAPSHOT,result)
        return {'updated_at':now,'counts':counts,'dates':sorted({s['bars'][-1]['date'] for s in stocks}),'stocks':len(stocks),'above500':sum(s['bars'][-1]['volume']>500 for s in stocks),'history_ready':sum(len(s['bars'])>=361 for s in stocks)}

def history(code):
    with snapshot_lock():
        snapshot=read_snapshot()
        stock=next((s for s in snapshot['stocks'] if s['code']==code),None)
        if stock is None:raise ValueError('Stock not found in the official stock universe')
        last=dt.date.fromisoformat(stock['bars'][-1]['date'])
        bars={}
        for back in range(20):
            total=last.year*12+last.month-1-back
            year,month=divmod(total,12);month+=1
            stamp=f'{year:04d}{month:02d}01'
            path=CACHE / f'{stock["source"]}-{code}-{stamp}.json'
            if path.exists() and back>0:
                data=json.loads(path.read_text(encoding='utf-8'))
            else:
                if stock['source'] in ('listed','listed_daily'):
                    url='https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?'+urllib.parse.urlencode({'date':stamp,'stockNo':code,'response':'json'})
                else:
                    url='https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock?'+urllib.parse.urlencode({'code':code,'date':f'{year:04d}/{month:02d}/01','response':'json'})
                data=get_json(url)
                if not isinstance(data,dict):raise ValueError('Historical source unavailable')
                atomic_json(path,data)
                time.sleep(.25)
            if stock['source'] in ('listed','listed_daily'):
                rows=data.get('data',[]); divisor=1000
            else:
                rows=data.get('tables',[{}])[0].get('data',[]);divisor=1
            for row in rows:
                if len(row)<7:continue
                b={'date':date_iso(row[0]),'volume':number(row[1]),'open':number(row[3]),'high':number(row[4]),'low':number(row[5]),'close':number(row[6])}
                if b['volume'] is not None:b['volume']/=divisor
                amount=number(row[2])
                if amount is not None and amount>0:b['amount']=amount
                if valid_bar(b) and b['date']<=last.isoformat():bars[b['date']]=b
        if len(bars)<2:raise ValueError('Historical source returned insufficient data; previous records kept')
        bars.update({b['date']:b for b in stock['bars']})
        stock['bars']=[bars[k] for k in sorted(bars)][-520:]
        atomic_json(SNAPSHOT,snapshot)
        return {'stock':stock,'history_days':len(stock['bars']),'complete':len(stock['bars'])>=361}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(PUBLIC),**kwargs)
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        super().end_headers()
    def do_POST(self):
        # Loopback only; do not permit cross-origin writes to the local updater.
        origin=self.headers.get('Origin','')
        if origin and origin not in ['http://127.0.0.1:8765','http://localhost:8765']:
            self.send_error(403);return
        try:
            parsed=urllib.parse.urlparse(self.path)
            if parsed.path=='/api/update':result=update()
            elif parsed.path=='/api/history':
                code=urllib.parse.parse_qs(parsed.query).get('code',[''])[0]
                if not re.fullmatch(r'[0-9A-Za-z]{4,8}',code):raise ValueError('Invalid stock code')
                result=history(code)
            else:self.send_error(404);return
            status=200
        except Exception as error:
            result={'error':str(error)};status=502
        body=json.dumps(result,ensure_ascii=False).encode('utf-8')
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--serve',action='store_true');parser.add_argument('--history');args=parser.parse_args()
    if args.serve:
        print('Serving http://127.0.0.1:8765/',flush=True)
        http.server.ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
    elif args.history:print(json.dumps(history(args.history),ensure_ascii=True))
    else:print(json.dumps(update(),ensure_ascii=True))

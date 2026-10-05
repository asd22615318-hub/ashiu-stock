"""Public daily institutional trades; all published share counts converted to lots."""
import json,urllib.request,time
from datetime import datetime,timedelta
from concurrent.futures import ThreadPoolExecutor
TWSE='https://www.twse.com.tw/rwd/zh/fund/T86?response=json&selectType=ALLBUT0999'
TPEX='https://www.tpex.org.tw/www/zh-tw/insti/dailyTrade'
def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(url,timeout=45) as r:return json.load(r)
        except Exception:
            if i==2:raise
            time.sleep(2)
def number(x):return float(str(x).replace(',',''))/1000
def date(s):return f'{s[:4]}-{s[4:6]}-{s[6:]}'
def update(root,public,offline=False):
    if offline:data=json.loads((root/'institutional-seed.json').read_text(encoding='utf-8'))
    else:
        listed=get(TWSE)
        if listed.get('stat')!='OK' or len(listed.get('data',[]))<500:raise ValueError('Incomplete TWSE report')
        end=datetime.strptime(listed['date'],'%Y%m%d')
        def report(day):
            ds=day.strftime('%Y%m%d');iso=day.strftime('%Y-%m-%d')
            tw=listed if ds==listed['date'] else get(TWSE+'&date='+ds)
            tp=get(TPEX+'?date='+day.strftime('%Y/%m/%d')+'&type=Daily&response=json')
            if tw.get('stat')!='OK':return None
            if tw.get('date')!=ds:raise ValueError('TWSE date mismatch')
            stocks={}
            for r in tw['data']:
                stocks[r[0].strip()]={'date':date(tw['date']),'foreign':{'buy':number(r[2]),'sell':number(r[3]),'net':number(r[4])},'trust':{'buy':number(r[8]),'sell':number(r[9]),'net':number(r[10])},'dealer':{'buy':number(r[12])+number(r[15]),'sell':number(r[13])+number(r[16]),'net':number(r[11])},'total':number(r[18])}
            tables=tp.get('tables',[])
            table=next((t for t in tables if t.get('data') and len(t['data'][0])==24),None)
            if not table:raise ValueError('Incomplete TPEx daily report '+iso)
            expected=str(day.year-1911)+'/'+day.strftime('%m/%d')
            if table.get('date')!=expected:raise ValueError('TPEx date mismatch')
            for r in table['data']:
                stocks[r[0].strip()]={'date':iso,'foreign':dict(zip(['buy','sell','net'],map(number,r[2:5]))),'trust':dict(zip(['buy','sell','net'],map(number,r[11:14]))),'dealer':dict(zip(['buy','sell','net'],map(number,r[20:23]))),'total':number(r[23])}
            return {'date':iso,'stocks':stocks}
        days=[end-timedelta(days=i) for i in range(24) if (end-timedelta(days=i)).weekday()<5]
        with ThreadPoolExecutor(max_workers=3) as pool:
            reports=[r for r in pool.map(report,days) if r][:10]
        if not reports:raise ValueError('No official daily reports')
        stocks=reports[0]['stocks']
        for code,d in stocks.items():
            history=[r['stocks'][code] for r in reports if code in r['stocks']]
            d['history_dates']=[h['date'] for h in history[:5]]
            d['five_day_ex_foreign']=sum(h['trust']['net']+h['dealer']['net'] for h in history[:5]) if len(reports)>=5 and all(code in r['stocks'] for r in reports[:5]) else None
            prior=history[5:10]
            d['previous_five_day_ex_foreign']=sum(h['trust']['net']+h['dealer']['net'] for h in prior) if len(reports)==10 and all(code in r['stocks'] for r in reports) else None
            base=d['previous_five_day_ex_foreign']
            d['five_day_change_pct']=(d['five_day_ex_foreign']-base)/base*100 if base is not None and base>0 and d['five_day_ex_foreign'] is not None else None
        data={'stocks':stocks,'sources':[TWSE,TPEX],'report_dates':[r['date'] for r in reports]}
    (public/'institutional-data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    return data

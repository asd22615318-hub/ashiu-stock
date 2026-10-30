"""Backfill missing actual trade values from dated TWSE/TPEx official reports."""
import concurrent.futures
import gzip
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

def fetch(day,market):
    compact=day.replace('-','')
    url=('https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?'+urllib.parse.urlencode(dict(type='ALLBUT0999',response='json',date=compact))) if market=='上市' else ('https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?'+urllib.parse.urlencode(dict(response='json',date=day.replace('-','/'))))
    request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(request,timeout=35) as response:data=json.load(response)
    if re.sub(r'\D','',str(data.get('date','')))!=compact or str(data.get('stat','')).lower()!='ok':
        raise ValueError('Official report date/status mismatch')
    amounts={}
    for table in data.get('tables',[]):
        fields=[re.sub(r'\s+|<[^>]*>','',str(f)) for f in table.get('fields',[])]
        code=next((i for i,f in enumerate(fields) if '代號' in f),None)
        value=next((i for i,f in enumerate(fields) if '成交金額' in f),None)
        if code is None or value is None:continue
        factor=1000 if '千' in fields[value] or '仟' in fields[value] else 1
        for row in table.get('data',[]):
            try:
                key=str(row[code]).strip();number=float(str(row[value]).replace(',',''))*factor
                if re.fullmatch(r'\d{4}',key) and number>0:amounts[key]=number
            except (ValueError,IndexError):pass
    if len(amounts)<100:raise ValueError('Incomplete official trade value report')
    return day,market,amounts,url

def update(root,market_path):
    root=Path(root);market=json.loads(gzip.decompress(Path(market_path).read_bytes()))
    latest=max(s['bars'][-1]['date'] for s in market['stocks'] if s.get('bars'))
    jobs=set()
    for stock in market['stocks']:
        if len(stock.get('bars',[]))<61 or stock['bars'][-1]['date']!=latest:continue
        for bar in stock['bars'][-20:]:
            if not bar.get('amount'):jobs.add((bar['date'],stock['market']))
    data={'version':1,'dates':{},'sources':[],'errors':{}}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures={pool.submit(fetch,*job):job for job in jobs}
        for future in concurrent.futures.as_completed(futures):
            job=futures[future]
            try:
                day,exchange,values,url=future.result();data['dates'].setdefault(day,{})[exchange]=values;data['sources'].append(url)
                print(day,exchange,len(values),flush=True)
            except Exception as e:data['errors']['/'.join(job)]=str(e);print(job,str(e),flush=True)
    (root/'featured-trade-values-seed.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    return data

if __name__=='__main__':
    import sys
    update(Path(__file__).resolve().parent,sys.argv[1])
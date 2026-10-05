"""Weekly aggregate TDCC holdings; preserve snapshots for weekly comparisons."""
import json,urllib.request,urllib.error,time
from pathlib import Path

URL='https://openapi.tdcc.com.tw/v1/opendata/1-5'
def aggregate(rows,source):
    weeks={}
    for date,code,level,count,shares,percent in rows:
        if int(level) not in (12,13,14,15):continue
        code=code.strip()
        date=f'{date[:4]}-{date[4:6]}-{date[6:8]}'
        stock=weeks.setdefault(date,{}).setdefault(code,{'400':0,'1000':0})
        stock['400']+=float(percent)
        if int(level)==15:stock['1000']+=float(percent)
    return [{'date':date,'source':source,'stocks':{c:{k:round(v,2) for k,v in s.items()} for c,s in stocks.items()}} for date,stocks in weeks.items()]

def update(root,public,site='',offline=False):
    data=json.loads((root/'ownership-seed.json').read_text(encoding='utf-8'))
    if not offline:
        if site:
            try:
                with urllib.request.urlopen(site+'/ownership-data.json',timeout=40) as r:prior=json.load(r)
                data['weeks']+=prior['weeks']
            except urllib.error.HTTPError as e:
                if e.code!=404:raise
                print('Initial ownership deployment: seed used')
        for attempt in range(3):
            try:
                with urllib.request.urlopen(URL,timeout=45) as r:rows=json.load(r)
                rows=[{k.lstrip('\ufeff'):v for k,v in row.items()} for row in rows]
                latest=aggregate([(r['資料日期'],r['證券代號'],r['持股分級'],r['人數'],r['股數'],r['占集保庫存數比例%']) for r in rows],URL)
                if len(latest)!=1 or len(latest[0]['stocks'])<1000:raise ValueError('Incomplete TDCC data')
                data['weeks']+=latest
                break
            except Exception:
                if attempt==2:raise
                time.sleep(2)
    data['weeks']=sorted({w['date']:w for w in data['weeks']}.values(),key=lambda w:w['date'])[-54:]
    (public/'ownership-data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print('Ownership weeks:',[w['date'] for w in data['weeks']])

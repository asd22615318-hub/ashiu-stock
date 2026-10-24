"""Weekly aggregate TDCC holdings; preserve snapshots for weekly comparisons."""
import csv,io,json,urllib.request,urllib.error,time
from pathlib import Path

URL='https://openapi.tdcc.com.tw/v1/opendata/1-5'
ARCHIVE='https://api.github.com/repos/wirelessr/tdcc-opendata-archive/contents/snapshots/'
def aggregate(rows,source):
    weeks={}
    rows=list(rows)
    singleton={(date,code.strip()) for date,code,level,count,shares,percent in rows if int(level)==17 and int(count)==1 and float(percent)>=99.99}
    for date,code,level,count,shares,percent in rows:
        if (date,code.strip()) in singleton:continue
        if int(level) not in (*range(1,10),12,13,14,15):continue
        code=code.strip()
        date=f'{date[:4]}-{date[4:6]}-{date[6:8]}'
        stock=weeks.setdefault(date,{}).setdefault(code,{'400':0,'1000':0,'small':0})
        if int(level)>=12:stock['400']+=float(percent)
        if int(level)<=9:stock['small']+=float(percent)
        if int(level)==15:stock['1000']+=float(percent)
    return [{'date':date,'source':source,'stocks':{c:{k:round(v,2) for k,v in s.items()} for c,s in stocks.items()}} for date,stocks in weeks.items()]

def backfill_archive_weeks(weeks,minimum=5):
    unique={week['date']:week for week in weeks}
    if len(unique)>=minimum:return list(unique.values())
    oldest=min(unique) if unique else '9999'
    for year in sorted({int(oldest[:4]),int(oldest[:4])-1},reverse=True):
        request=urllib.request.Request(ARCHIVE+str(year),headers={'User-Agent':'ashiu-stock/1.0','Accept':'application/vnd.github+json'})
        with urllib.request.urlopen(request,timeout=40) as response:files=json.load(response)
        candidates=sorted((entry for entry in files if entry['name'].endswith('.csv') and entry['name'][:10]<oldest),key=lambda entry:entry['name'],reverse=True)
        for entry in candidates:
            if len(unique)>=minimum:break
            with urllib.request.urlopen(entry['download_url'],timeout=60) as response:raw=response.read()
            text=raw.decode('utf-8-sig') if raw.startswith(b'\xef\xbb\xbf') else raw.decode('cp950')
            rows=[row[:6] for row in csv.reader(io.StringIO(text,newline='')) if len(row)>=6 and row[0].isdigit() and row[2].isdigit()]
            parsed=aggregate(rows,entry['html_url'])
            if len(parsed)!=1 or len(parsed[0]['stocks'])<1000:continue
            unique.setdefault(parsed[0]['date'],parsed[0])
        if len(unique)>=minimum:break
    return list(unique.values())

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
    if not offline and len({w['date'] for w in data['weeks']})<5:
        try:data['weeks']=backfill_archive_weeks(data['weeks'])
        except Exception as exc:print('Ownership archive backfill unavailable:',exc)
    data['weeks']=sorted({w['date']:w for w in data['weeks']}.values(),key=lambda w:w['date'])[-54:]
    (public/'ownership-data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print('Ownership weeks:',[w['date'] for w in data['weeks']])


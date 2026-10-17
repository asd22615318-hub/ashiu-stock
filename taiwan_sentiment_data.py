"""Preserve the Taiwan model's history and refresh recent official inputs.

Index, financing and foreign flow keep their original units (points / TWD100m).
Missing observations remain missing. No US or crypto indicator is reused.
"""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import urllib.request

def get(url):
    with urllib.request.urlopen(url,timeout=30) as response:return json.load(response)

def number(v):
    try:return float(str(v).replace(',',''))
    except (ValueError,TypeError):return None

def iso(s):
    if '/' in s:
        y,m,d=map(int,s.split('/'));return f'{y+1911:04}-{m:02}-{d:02}'
    return f'{s[:4]}-{s[4:6]}-{s[6:8]}'

def update(root,public):
    root,public=Path(root),Path(public);target=root/'taiwan-sentiment-seed.json'
    initial=json.loads((root/'futchip-seed.json').read_text(encoding='utf-8'))
    saved=json.loads(target.read_text(encoding='utf-8')) if target.exists() else {'rows':[]}
    rows={r['d']:dict(r) for r in initial.get('rows',[])}
    # Officially completed observations take precedence over older public mirrors.
    for r in saved.get('rows',[]):rows.setdefault(r['d'],{}).update(r)
    today=dt.datetime.now(dt.timezone(dt.timedelta(hours=8)))
    day=today.strftime('%Y%m%d')
    sources={
      'index':f'https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK?date={day[:6]}01&response=json',
      'margin':f'https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN_TREND?date={day}&days=30&response=json',
      'otc':'https://www.tpex.org.tw/www/zh-tw/dashboardOtc/marginTrend?lang=zh-tw&days=30',
    }
    results={};errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        tasks={pool.submit(get,u):key for key,u in sources.items()}
        for future in concurrent.futures.as_completed(tasks):
            key=tasks[future]
            try:results[key]=future.result()
            except Exception as exc:errors.append(key+': '+str(exc))
    def set_value(date,key,v):
        if v is not None:rows.setdefault(date,{'d':date})[key]=v
    if results.get('index',{}).get('stat')=='OK':
        for r in results['index'].get('data',[]):set_value(iso(r[0]),'i',number(r[4]))
    if results.get('margin',{}).get('stat')=='OK':
        for r in results['margin'].get('data',[]):
            v=number(r.get('marginAmt'));set_value(iso(r['date']),'mt',v/100000 if v is not None else None)
    if results.get('otc',{}).get('stat')=='ok':
        for r in results['otc'].get('trend',[]):
            set_value(iso(r['date']),'o',number(r.get('index')))
            set_value(iso(r['date']),'mo',number(r.get('marginBalance')))
    # Fetch missing daily foreign turnover only; do not repeat known reports.
    needed=[d for d in sorted(rows) if d<=today.date().isoformat() and rows[d].get('i') and rows[d].get('sf') is None][-30:]
    for d in needed:
        url=f'https://www.twse.com.tw/rwd/zh/fund/BFI82U?response=json&dayDate={d.replace("-","")}&type=day'
        try:
            j=get(url)
            if j.get('stat')!='OK' or iso(j.get('date',''))!=d:raise ValueError('Foreign report date mismatch')
            values=[number(r[3]) for r in j.get('data',[]) if r[0] in ('外資及陸資(不含外資自營商)','外資自營商')]
            if len(values)!=2 or any(v is None for v in values):raise ValueError('Incomplete foreign report')
            set_value(d,'sf',sum(values)/1e8)
        except Exception as exc:errors.append(d+': '+str(exc))
    selected=[{k:r[k] for k in ('d','i','o','mt','mo','sf') if k in r} for d,r in sorted(rows.items()) if d<=today.date().isoformat()]
    data=dict(version=1,source='https://www.twse.com.tw/dashboard/zh/credit/margin.html',
      sourceKind='公開歷史彙整＋證交所、櫃買官方近期補齊',built=today.isoformat(),
      sources=list(sources.values())+['https://www.twse.com.tw/rwd/zh/fund/BFI82U','https://zhuang.tw/futchip'],
      rows=selected,errors=errors)
    if not selected:raise ValueError('No Taiwan observations')
    text=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    target.write_text(text,encoding='utf-8');public.mkdir(exist_ok=True)
    (public/'taiwan-sentiment-data.json').write_text(text,encoding='utf-8')
    print('Taiwan sentiment input:',selected[-1]['d'],'rows:',len(selected),'errors:',len(errors),flush=True)
    return data

if __name__=='__main__':
    root=Path(__file__).resolve().parent;update(root,root/'dist')

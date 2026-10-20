"""Single-session watch-branch net buys; never reuse the weekly broker report."""
import concurrent.futures
import gzip
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, ROUND_FLOOR
from pathlib import Path
from broker_data import BASE, parse_report

CORE_WATCH = ['凱基-台北', '凱基-松山', '元大-土城永寧', '富邦-虎尾', '凱基-虎尾']
CUSTOM_WATCH = ['凱基-城中', '元大-台南', '元大-向上', '元大-文心', '玉山-嘉義',
                '統一-嘉義', '永豐金-市政', '富邦-建國', '元富-松德', '美林', '摩根大通', '美商高盛']
PUBLIC_GROUPS = [
    {'title':'籌碼 K 先生：隔日沖主力功能教學（2026/06）',
     'url':'https://cmnews.com.tw/article/chipk-54522a37-5d55-11f1-8a05-95d60f2280db',
     'branches':['富邦-嘉義']},
    {'title':'萬寶週刊：市場常見隔日沖分點',
     'url':'https://www.marboweekly.com.tw/report/2229.html',
     'branches':['群益金鼎-大安','富邦-建國','凱基-市政','美林','富邦-嘉義']},
    {'title':'玩股華安：公開文章點名分點（2026/04）',
     'url':'https://www.wantgoo.com/blog/407988/post/593',
     'branches':['凱基-台北','凱基-士林','凱基-市政','凱基-板橋','凱基-屏東',
                 '元大-土城永寧','元大-太平','元大-成功','富邦-建國','富邦-台中','富邦-台南',
                 '統一-仁愛','元大-虎尾','永豐金-虎尾','富邦-虎尾']},
    {'title':'CMoney 用戶歷史筆記：隔日沖分點（舊名單）',
     'url':'https://www.cmoney.tw/notes/note-detail.aspx?nid=10412',
     'branches':['統一-士林','富邦-嘉義','統一-嘉義','元富-虎尾','凱基-斗六','統一-敦南']},
    {'title':'ToAlpha：公開行為統計頁（查核 2026/10/20）',
     'url':'https://toalpha.tw/market/daytrade',
     'branches':['凱基-城中','富邦-南屯','群益金鼎-館前']}
]
PUBLIC_WATCH = list(dict.fromkeys(b for source in PUBLIC_GROUPS for b in source['branches']))
WATCH = list(dict.fromkeys(CORE_WATCH + CUSTOM_WATCH + PUBLIC_WATCH))
SOURCES = [
    {'title':'CMoney：常見隔日沖分點', 'url':'https://www.cmoney.tw/learn/course/chipsanalysisfast/topic/1619'},
    {'title':'雷風學院：分點分類教材（操作風格可能改變）', 'url':'https://school.thunderwind.com.tw/file/novice.pdf'}
]


def match_name(name):
    # Normalize punctuation only; do not merge a broker's different branches.
    value=name.replace('－','-').replace('–','-').replace(' ','').strip()
    return value


def limit_up(previous):
    """Standard common-stock tick rounding; previous close is an estimate of reference."""
    cap=Decimal(str(previous))*Decimal('1.10')
    tick=next(Decimal(step) for bound,step in [(10,'.01'),(50,'.05'),(100,'.1'),(500,'.5'),(1000,'1'),(float('inf'),'5')] if cap<bound)
    return (cap/tick).to_integral_value(rounding=ROUND_FLOOR)*tick


def signals(report, stock, day):
    if report['start'] != day or report['end'] != day or report['unit'] != 'lots':
        raise ValueError('Not a single-session lot report')
    index=next(i for i,b in enumerate(stock['bars']) if b['date']==day)
    bar=stock['bars'][index]
    if bar['close']<20 or index==0 or stock['bars'][index-1]['close']<=0:return None
    previous=stock['bars'][index-1]['close']
    estimated_limit=limit_up(previous)
    if Decimal(str(bar['close']))!=estimated_limit:return None
    found = [b for b in report['buyers'] if match_name(b['name']) in WATCH and b['net_lots'] > 0]
    if not found:
        return None
    net = sum(b['net_lots'] for b in found)
    return dict(code=stock['code'],name=stock['name'],date=day,close=bar['close'],volume=bar['volume'],
                change_pct=(bar['close']/previous-1)*100,estimated_limit=float(estimated_limit),
                net_lots=net,ratio=net/bar['volume']*100,branches=found,source=report['source'])


def update(root, market_path=None):
    root = Path(root)
    path = Path(market_path) if market_path else root/'seed.json.gz'
    market = json.loads(gzip.decompress(path.read_bytes()))
    day = max(s['bars'][-1]['date'] for s in market['stocks'] if s.get('bars'))
    universe = [s for s in market['stocks'] if s.get('bars') and s['bars'][-1]['date']==day
                and s['bars'][-1].get('volume',0)>500]
    target = root/'overnight-seed.json'
    prior = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {}
    cache_path=root/'overnight-cache.json'
    cached=json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else {}
    reports = cached.get('reports',{}) if cached.get('date')==day else {}
    reports = {s['code']:reports[s['code']] for s in universe if s['code'] in reports}
    errors = {}
    def fetch(stock):
        code = stock['code']
        url = BASE+'?'+urllib.parse.urlencode(dict(a=code,e=day,f=day))
        time.sleep(.25)
        req=urllib.request.Request(url,headers={'User-Agent':'AshiuStockResearch/1.0'})
        with urllib.request.urlopen(req,timeout=18) as response:
            raw=response.read().decode('cp950','replace')
        return code,parse_report(raw,code,day,day)
    pending=[s for s in universe if s['code'] not in reports]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        work={pool.submit(fetch,s):s['code'] for s in pending}
        for i,future in enumerate(concurrent.futures.as_completed(work),1):
            code=work[future]
            try:
                key,report=future.result(); reports[key]=report
            except Exception as exc:
                errors[code]=str(exc)[:140]
            if i%50==0: print('Daily branch reports',i,'/',len(pending),'valid',len(reports),flush=True)
    if not reports:
        raise ValueError('No valid single-session reports; preserve previous snapshot')
    cache_path.write_text(json.dumps({'date':day,'reports':reports},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    rows=[row for s in universe if s['code'] in reports
          if (row:=signals(reports[s['code']],s,day))]
    rows.sort(key=lambda r:r['code'])
    seen={match_name(b['name']) for report in reports.values() for side in ('buyers','sellers') for b in report[side]}
    data=dict(version=1,date=day,updated_at=datetime.now(timezone.utc).isoformat(),watch=WATCH,
              core_watch=CORE_WATCH,custom_watch=CUSTOM_WATCH,public_watch=PUBLIC_WATCH,sources=SOURCES+PUBLIC_GROUPS,
              unseen_watch=[name for name in WATCH if name not in seen],
              scope='Close >= 20 + estimated limit-up close + volume > 500 lots + positive watch-branch net buy; Top-15 only',
              filter_rule='estimated_limit_up',requested=len(universe),available=len(reports),errors=errors,matched=len(rows),rows=rows,unit='lots')
    if prior.get('date','')>day: raise ValueError('Refuse older daily snapshot')
    text=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    target.write_text(text,encoding='utf-8')
    (root/'dist').mkdir(exist_ok=True)
    (root/'dist'/'overnight-data.json').write_text(text,encoding='utf-8')
    print(json.dumps({k:data[k] for k in ['date','requested','available']},ensure_ascii=True),
          'signals',len(rows),'missing',len(errors),flush=True)
    return data


if __name__=='__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    update(Path(__file__).resolve().parent,sys.argv[1] if len(sys.argv)>1 else None)

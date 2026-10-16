"""Aligned Top-15 branch net flow from Capital's public, lot-denominated report.

This is branch concentration, not the identity of large investors. TWSE/TPEx
price-level daily reports remain the official manual verification sources.
Only the positive TDCC/institution candidates need branch collection.
"""
import gzip
import html
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

BASE = 'https://stock.capital.com.tw/z/zc/zco/zco.djhtm'


class Rows(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows = []; self.row = None; self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr': self.row = []
        if tag in ('td', 'th'): self.cell = []

    def handle_data(self, value):
        if self.cell is not None: self.cell.append(value)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            if self.row is not None: self.row.append(''.join(self.cell).strip())
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.rows.append(self.row); self.row = None


def parse_report(text, code, start, end):
    if not re.search(r'主力賣買超-' + re.escape(code) + r'\D', text):
        raise ValueError('Report stock does not match')
    def iso(value):
        return datetime.strptime(value, '%Y/%m/%d').date().isoformat()
    begin = re.search(r"getYMD2\s*=\s*'([\d/]+)'", text)
    finish = re.search(r"getYMD1\s*=\s*'([\d/]+)'", text)
    if not begin or not finish or iso(begin[1]) != start or iso(finish[1]) != end:
        raise ValueError('Report period does not match')
    visible = html.unescape(re.sub('<[^>]+>', ' ', text))
    updated = re.search(r'最後更新日[：:]\s*([\d/]+)', visible)
    if not updated or iso(updated[1]) != end or not re.search(r'單位[：:]\s*張', visible):
        raise ValueError('Stale report or incorrect unit')
    parser = Rows(); parser.feed(text)
    entries = [r for r in parser.rows if len(r) == 10 and all(re.fullmatch(r'[\d,]+(?:\.\d+)?', r[j]) for j in (1,2,3,6,7,8))]
    if len(entries) != 15: raise ValueError('Incomplete Top-15 report')
    num = lambda s: float(s.replace(',', ''))
    buyers = [{'name':r[0], 'buy_lots':num(r[1]), 'sell_lots':num(r[2]), 'net_lots':num(r[3])} for r in entries]
    sellers = [{'name':r[5], 'buy_lots':num(r[6]), 'sell_lots':num(r[7]), 'net_lots':num(r[8])} for r in entries]
    if any(not r['name'] for r in buyers+sellers): raise ValueError('Missing branch name')
    if len({r['name'] for r in buyers}) != 15 or len({r['name'] for r in sellers}) != 15:
        raise ValueError('Duplicate branch')
    if any(abs(r['buy_lots']-r['sell_lots']-r['net_lots'])>1.1 for r in buyers):
        raise ValueError('Buy-side arithmetic mismatch')
    if any(abs(r['sell_lots']-r['buy_lots']-r['net_lots'])>1.1 for r in sellers):
        raise ValueError('Sell-side arithmetic mismatch')
    if any(side[i+1]['net_lots']-side[i]['net_lots']>1.1 for side in (buyers,sellers) for i in range(14)):
        raise ValueError('Top-15 report is not ordered')
    # The public report rounds individual lots. Use its explicit aggregate totals.
    totals = [r for r in parser.rows if len(r) == 4 and '合計買超張數' in r[0] and '合計賣超張數' in r[2]]
    if len(totals) != 1: raise ValueError('Missing aggregate totals')
    buy, sell = num(totals[0][1]), num(totals[0][3])
    if abs(sum(r['net_lots'] for r in buyers)-buy)>16 or abs(sum(r['net_lots'] for r in sellers)-sell)>16:
        raise ValueError('Branch totals do not reconcile')
    return dict(code=code,start=start,end=end,top_n=15,buy_lots=buy,sell_lots=sell,
                net_lots=buy-sell,buyers=buyers,sellers=sellers,unit='lots',
                source=BASE+'?'+urllib.parse.urlencode(dict(a=code,e=start,f=end)))


def candidates(market, ownership, institutions, previous, current):
    dates = sorted({b['date'] for s in market['stocks'] for b in s['bars'] if previous['date'] < b['date'] <= current['date']})
    if not dates or not set(dates).issubset(institutions.get('report_dates', [])): return dates, []
    result = []
    for stock in market['stocks']:
        code = stock['code']; bars = {b['date']:b for b in stock['bars']}
        if not stock['bars'] or stock['bars'][-1].get('volume',0) <= 500: continue
        now = current['stocks'].get(code,{}).get('400'); old = previous['stocks'].get(code,{}).get('400')
        if now is None or old is None or round(now-old,2) <= 0: continue
        history = {r['date']:r for r in institutions['stocks'].get(code,{}).get('daily_history',[])}
        if any(d not in bars or d not in history or bars[d].get('volume') is None or history[d].get('total') is None for d in dates): continue
        if sum(history[d]['total'] for d in dates)>0: result.append(code)
    return dates, result


def update(root, public, max_periods=2):
    root, public = Path(root), Path(public)
    target = root/'broker-seed.json'
    prior = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {'periods':[]}
    market = json.loads(gzip.decompress((root/'seed.json.gz').read_bytes()))
    # Normal build has a freshly updated snapshot; offline calls use the seed.
    if (public/'market-data.json').exists():
        fresh=json.loads((public/'market-data.json').read_text(encoding='utf-8'))
        if fresh.get('updated_at','')>market.get('updated_at',''): market=fresh
    read = lambda file, seed: json.loads((public/file if (public/file).exists() else root/seed).read_text(encoding='utf-8'))
    ownership = read('ownership-data.json','ownership-seed.json')
    institutions = read('institutional-data.json','institutional-seed.json')
    weeks = sorted(ownership['weeks'],key=lambda w:w['date'])
    periods = {p['end']:p for p in prior['periods']}
    for index in range(max(1,len(weeks)-max_periods),len(weeks)):
        previous,current=weeks[index-1:index+1]
        dates,codes=candidates(market,ownership,institutions,previous,current)
        if not dates: continue
        period=periods.get(current['date'],{})
        if period.get('start')!=dates[0]: period={}
        stocks=period.get('stocks',{}); errors={}
        for code in codes:
            if code in stocks: continue
            url=BASE+'?'+urllib.parse.urlencode(dict(a=code,e=dates[0],f=dates[-1]))
            try:
                req=urllib.request.Request(url,headers={'User-Agent':'AshiuStockResearch/1.0'})
                with urllib.request.urlopen(req,timeout=25) as response: raw=response.read().decode('cp950','replace')
                stocks[code]=parse_report(raw,code,dates[0],dates[-1])
            except Exception as exc: errors[code]=str(exc)[:180]
            time.sleep(0.5)
        periods[current['date']]=dict(start=dates[0],end=dates[-1],dates=dates,stocks=stocks,
            requested=len(codes),available=sum(c in stocks for c in codes),errors=errors)
        print('Branch period',dates[0],dates[-1],len(codes),'candidates,',len(errors),'missing',flush=True)
    data=dict(version=1,updated_at=datetime.now(timezone.utc).isoformat(),source=BASE,
              methodology='Top15 net-buy lots minus Top15 net-sell lots; rounded public report totals; branch flow is not investor identity',
              periods=sorted(periods.values(),key=lambda p:p['end'])[-8:])
    serialized=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    target.write_text(serialized,encoding='utf-8'); public.mkdir(exist_ok=True)
    (public/'broker-data.json').write_text(serialized,encoding='utf-8')
    return data


if __name__=='__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    root=Path(__file__).resolve().parent
    update(root,root/'dist',int(sys.argv[1]) if len(sys.argv)>1 else 2)

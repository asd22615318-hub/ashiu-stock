"""Preserve valuation-dated active ETF portfolios from official fund disclosures."""
import concurrent.futures, datetime as dt, http.cookiejar, io, json, re, urllib.request, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FUNDS = [
    ('00981A', '主動統一台股增長', 'ez', '49YTW', 'https://www.ezmoney.com.tw/ETF/Fund/Info?fundCode=49YTW'),
    ('00403A', '主動統一升級50', 'ez', '63YTW', 'https://www.ezmoney.com.tw/ETF/Fund/Info?fundCode=63YTW'),
    ('00991A', '主動復華未來50', 'fh', 'ETF23', 'https://www.fhtrust.com.tw/ETF'),
    ('00982A', '主動群益台灣強棒', 'cap', '399', 'https://www.capitalfund.com.tw/etf/product/detail/399/buyback'),
    ('00992A', '主動群益科技創新', 'cap', '500', 'https://www.capitalfund.com.tw/etf/product/detail/500/buyback'),
]

def number(v):
    return float(str(v or 0).replace(',', '').replace('%', ''))

def date_value(v):
    m = re.search(r'/Date\((-?\d+)', str(v))
    return dt.datetime.fromtimestamp(int(m[1])/1000, dt.timezone(dt.timedelta(hours=8))).date().isoformat() if m else str(v)[:10].replace('/', '-')

def read_excel(b):
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            shared = [''.join(t.itertext()) for t in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', ns)]
        rows = []
        for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:row', ns):
            vals = {}
            for c in row.findall('s:c', ns):
                col = re.match('[A-Z]+', c.attrib['r'])[0]
                i = 0
                for a in col: i = i*26 + ord(a)-64
                v = c.find('s:v', ns)
                text = v.text if v is not None else ''.join(c.find('s:is', ns).itertext()) if c.find('s:is', ns) is not None else ''
                vals[i-1] = shared[int(text)] if c.get('t') == 's' else text
            rows.append([vals.get(i, '') for i in range(max(vals, default=-1)+1)])
        return rows

def fetch_one(fund, valuation, offset=1):
    code, name, provider, key, source = fund
    nextday = valuation + dt.timedelta(days=offset)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def get(url, payload=None):
        req = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None,
            headers={'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json'})
        return opener.open(req, timeout=25).read()
    holdings = []
    if provider == 'ez':
        get('https://www.ezmoney.com.tw/')
        x = json.loads(get('https://www.ezmoney.com.tw/ETF/Transaction/GetPCF', {'fundCode':key, 'date':f'{nextday.year-1911}/{nextday:%m/%d}', 'specificDate':True}))
        p = {r['PCFCode']: r for r in x['pcf']}
        day = date_value(p['NAV']['TranDate']); nav = p['NAV']['Amount']; units = p['OUT_UNIT']['Amount']
        for asset in x['asset']:
            if asset['AssetCode'] == 'ST':
                holdings = [{'code':r['DetailCode'].strip(), 'name':r['DetailName'].strip(), 'shares':r['Share'], 'weight':r['NavRate'], 'value':r['Amount']} for r in asset['Details']]
        publication = date_value(p['NAV']['PostDate'])
    elif provider == 'cap':
        x = json.loads(get('https://www.capitalfund.com.tw/CFWeb/api/etf/buyback', {'fundId':key, 'date':nextday.isoformat()}))['data']
        p = x['pcf']; day = p['date2']; publication = p['date1']; nav = p['nav']; units = p['totUnit']
        holdings = [{'code':r['stocNo'].strip(), 'name':r['stocName'].strip(), 'shares':r['share'], 'weight':r['weight'], 'value':nav*r['weight']/100} for r in x['stocks']]
    else:
        rows = read_excel(get(f'https://www.fhtrust.com.tw/api/assetsExcel/{key}/{valuation:%Y%m%d}'))
        joined = ' '.join(str(r[0]) for r in rows if r)
        m = re.search(r'日期[:：]\s*(\d{4}/\d{2}/\d{2})', joined)
        if not m: raise ValueError('Missing official valuation date')
        day = m[1].replace('/', '-'); publication = day
        def after(label):
            for i,r in enumerate(rows):
                if r and str(r[0]).strip() == label: return number(rows[i+1][0])
            raise ValueError('Missing '+label)
        nav = after('基金資產淨值'); units = after('基金在外流通單位數')
        for r in rows:
            if len(r)>=5 and re.fullmatch(r'\d{4}', str(r[0]).strip()):
                holdings.append({'code':str(r[0]).strip(), 'name':str(r[1]).strip(), 'shares':number(r[2]), 'value':number(r[3]), 'weight':number(r[4])})
    if day != valuation.isoformat(): raise ValueError(f'Request {valuation}, official valuation {day}')
    holdings = [r for r in holdings if re.fullmatch(r'\d{4}',r['code']) and r['shares']>0]
    if len(holdings)<15 or nav<=0 or units<=0 or not 50<sum(r['weight'] for r in holdings)<105: raise ValueError('Incomplete portfolio')
    if len({r['code'] for r in holdings}) != len(holdings): raise ValueError('Duplicate stocks')
    return code, {'date':day, 'publication_date':publication, 'nav':nav, 'units':units, 'holdings':holdings}

def fetch(fund, valuation):
    if fund[2] == 'fh': return fetch_one(fund,valuation)
    error = None
    for offset in range(1,7):
        try: return fetch_one(fund,valuation,offset)
        except Exception as e:
            error = e
            # A later valuation must never be relabelled as the requested date.
            if 'official valuation' in str(e) and str(e).split('official valuation ')[-1] > valuation.isoformat(): break
    raise error

def update(root=ROOT, public=None, backfill=False, end=None):
    root = Path(root); seed = root/'etf-seed.json'
    x = json.loads(seed.read_text(encoding='utf-8')) if seed.exists() else {'funds':{}, 'schema':1}
    today = end or dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    days = [today-dt.timedelta(days=i) for i in range(17 if backfill else 4)]
    jobs = [(f,d) for f in FUNDS for d in days if d.weekday()<5 and (backfill or d.isoformat() not in x.get('funds',{}).get(f[0],{}).get('snapshots',{}))]
    good = 0; errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        pending = {pool.submit(fetch,f,d):(f,d) for f,d in jobs}
        for future in concurrent.futures.as_completed(pending):
            f,d = pending[future]
            try:
                code,snapshot = future.result()
                fund = x['funds'].setdefault(code, {'code':code, 'name':f[1], 'source':f[4], 'snapshots':{}})
                fund['snapshots'][snapshot['date']] = snapshot; good += 1
            except Exception as e: errors.append(f'{f[0]} {d}: {type(e).__name__} {e}')
    x['updated_at'] = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat()
    x['last_fetch'] = {'successes':good, 'issues':errors}
    for fund in x['funds'].values(): fund['snapshots'] = dict(sorted(fund['snapshots'].items())[-120:])
    if not x['funds']: raise RuntimeError('No official ETF portfolios available')
    b = json.dumps(x, ensure_ascii=False,separators=(',',':')).encode()
    tmp = seed.with_suffix('.tmp'); tmp.write_bytes(b); tmp.replace(seed)
    if public: (Path(public)/'etf-data.json').write_bytes(b)
    common = set.intersection(*(set(f['snapshots']) for f in x['funds'].values())) if len(x['funds'])==5 else set()
    print(json.dumps({'etf_funds':len(x['funds']), 'common_dates':sorted(common), 'successes':good, 'failed_requests':len(errors)},ensure_ascii=False))
    return x

if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser(); p.add_argument('--backfill',action='store_true'); p.add_argument('--end'); a = p.parse_args()
    update(backfill=a.backfill,end=dt.date.fromisoformat(a.end) if a.end else None)

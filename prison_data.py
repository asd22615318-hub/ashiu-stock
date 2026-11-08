"""Official disposal notices, cumulative warnings and exchange calendar."""
import json, os, re
from datetime import datetime, timezone, timedelta, date
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from html import unescape
from urllib.request import Request, urlopen
from regulatory_data import get, iso, minutes, TW_P, TP_P

TW_W = 'https://www.twse.com.tw/announcement/notetrans?response=json'
TP_W = 'https://www.tpex.org.tw/openapi/v1/tpex_trading_warning_note'


SUSPECT_URL = 'https://zhuang.tw/prison'

def parse_suspect_thresholds(page):
    def plain(fragment):
        return ' '.join(unescape(re.sub(r'<[^>]+>', ' ', fragment)).split())

    snapshot = re.search(r'資料快照\s+(\d{4}-\d{2}-\d{2})', plain(page))
    section = re.search(r'<h2\b[^>]*>([^<]*嫌疑名單[\s\S]*?)</h2>([\s\S]*?)(?=<h2\b|$)', page)
    if not snapshot or not section:
        raise ValueError('Public suspect list layout not recognized')
    origin = date.fromisoformat(snapshot[1])
    target_md = re.search(r'明天\s*\((\d{1,2})/(\d{1,2})\)', plain(section[1]))
    if not target_md:
        raise ValueError('Public threshold date missing')
    month, day = map(int, target_md.groups())
    target = date(origin.year + (month < origin.month), month, day)
    if not 0 < (target-origin).days <= 14:
        raise ValueError('Public threshold date outside expected window')

    rows = {}
    for fragment in re.split(r'<div class="gcard wcard(?: [^"]*)?">', section[2])[1:]:
        label = plain(fragment.split('class="wc-cond"', 1)[0])
        key = re.search(r'(?<!\d)(\d{4})\s*·\s*(上市|上櫃)', label)
        if not key:
            continue
        conditions = []
        for raw in re.findall(r'<div class="cl">([\s\S]*?)</div>', fragment):
            line = plain(raw)
            numeric = re.match(r'(收盤|成交量)\s*(>=|<=|[><≥≤])\s*([\d,]+(?:\.\d+)?)\s*(元|張)', line)
            if numeric:
                kind, operator, value, unit = numeric.groups()
                if (kind, unit) in [('收盤','元'),('成交量','張')]:
                    conditions.append({'kind': 'close' if kind=='收盤' else 'volume',
                                       'operator': operator, 'value': float(value.replace(',',''))})
            elif '跌方向' in line:
                conditions.append({'kind':'downside'})
            elif '第二款' in line:
                conditions.append({'kind':'clause2'})
        if conditions:
            risk = 'high' if '高機率' in label else 'low' if '低機率' in label else None
            rows[key[2]+':'+key[1]] = {'risk':risk, 'conditions':conditions}
    return {'snapshot':origin.isoformat(),'target':target.isoformat(),'rows':rows}

def fetch_suspect_thresholds():
    request = Request(SUSPECT_URL, headers={'User-Agent':'Mozilla/5.0'})
    with urlopen(request, timeout=15) as response:
        return parse_suspect_thresholds(response.read(2_000_000).decode('utf-8'))

def update(root, public):
    now = datetime.now(timezone(timedelta(hours=8)))
    urls = [TW_P, TP_P, TW_W, TP_W, f'https://www.twse.com.tw/rwd/zh/holidaySchedule/holidaySchedule?response=json&queryYear={now.year-1911}']
    with ThreadPoolExecutor(max_workers=5) as pool:
        tw, tp, warning, tp_warning, calendar = list(pool.map(get, urls))
    if not all(isinstance(x, list) for x in [tw, tp, tp_warning]) or warning.get('stat') != 'OK' or calendar.get('stat','').lower() != 'ok':
        raise ValueError('Invalid official disposal response')
    title_date = re.search(r'(\d+)年(\d+)月(\d+)日', warning['title'])
    if not title_date: raise ValueError('Warning date missing')
    tw_date = f'{int(title_date[1])+1911:04d}-{int(title_date[2]):02d}-{int(title_date[3]):02d}'
    seed = root/'prison-seed.json'
    prior = json.loads(seed.read_text(encoding='utf-8')) if seed.exists() else {}
    notices = {(r['market'],r['code'],r['start'],r['announcement_date']):r for r in prior.get('disposals',[])}
    for rows, market, source, ck, nk, dk, rk in [(tw,'上市',TW_P,'Code','Name','Detail','ReasonsOfDisposition'),(tp,'上櫃',TP_P,'SecuritiesCompanyCode','CompanyName','DisposalCondition','DispositionReasons')]:
        for r in rows:
            code=r.get(ck,'').strip()
            if not re.fullmatch(r'\d{4}',code): continue
            period=re.split(r'[～~至]',r['DispositionPeriod'])
            if len(period)!=2: raise ValueError('Invalid disposal period')
            entry={'code':code,'name':r[nk].strip(),'market':market,'start':iso(period[0]),'end':iso(period[1]),'announcement_date':iso(r['Date']),'minutes':minutes(r[dk]),'reason':r.get(rk,''),'detail':r[dk],'source':source}
            notices[(market,code,entry['start'],entry['announcement_date'])]=entry
    warnings=[{'code':str(r[1]),'name':r[2],'market':'上市','date':tw_date,'detail':r[3],'source':TW_W} for r in warning.get('data',[]) if re.fullmatch(r'\d{4}',str(r[1]))]
    warnings += [{'code':r['SecuritiesCompanyCode'],'name':r['CompanyName'],'market':'上櫃','date':iso(r['Date']),'detail':r['AccumulationSituation'],'source':TP_W} for r in tp_warning if re.fullmatch(r'\d{4}',r['SecuritiesCompanyCode'])]
    # Calendar also lists the first/last trading dates; those must remain trading days.
    closed=[r[0] for r in calendar['data'] if '開始交易' not in r[1] and '最後交易' not in r[1] and '開始交易' not in r[2]]
    result={'updated_at':now.isoformat(),'as_of':now.date().isoformat(),'warning_dates':{'上市':tw_date,'上櫃':max((iso(r['Date']) for r in tp_warning),default=None)},'calendar_year':now.year,'closed_dates':closed,'history_started':prior.get('history_started',now.date().isoformat()),'disposals':sorted(notices.values(),key=lambda r:(r['start'],r['code'])),'warnings':warnings,'sources':urls}
    try:
        result['suspect_thresholds'] = fetch_suspect_thresholds()
    except Exception as exc:
        print('Public suspect thresholds unavailable:', exc, flush=True)
        if prior.get('suspect_thresholds'):
            result['suspect_thresholds'] = prior['suspect_thresholds']
    public.mkdir(exist_ok=True)
    for target in [seed,public/'prison-data.json']:
        temp=target.with_suffix('.tmp');temp.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8');os.replace(temp,target)
    return result

if __name__=='__main__':
    root=Path(__file__).resolve().parent
    result=update(root,root/'dist')
    print(json.dumps({'as_of':result['as_of'],'disposals':len(result['disposals']),'warnings':len(result['warnings'])}))

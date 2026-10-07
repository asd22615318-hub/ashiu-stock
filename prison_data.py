"""Official disposal notices, cumulative warnings and exchange calendar."""
import json, os, re
from datetime import datetime, timezone, timedelta, date
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from regulatory_data import get, iso, minutes, TW_P, TP_P

TW_W = 'https://www.twse.com.tw/announcement/notetrans?response=json'
TP_W = 'https://www.tpex.org.tw/openapi/v1/tpex_trading_warning_note'

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
    public.mkdir(exist_ok=True)
    for target in [seed,public/'prison-data.json']:
        temp=target.with_suffix('.tmp');temp.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8');os.replace(temp,target)
    return result

if __name__=='__main__':
    root=Path(__file__).resolve().parent
    result=update(root,root/'dist')
    print(json.dumps({'as_of':result['as_of'],'disposals':len(result['disposals']),'warnings':len(result['warnings'])}))

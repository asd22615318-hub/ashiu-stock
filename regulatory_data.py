"""Official attention announcements and disposal periods; never infer minutes from count."""
import json,re,urllib.request,os
from datetime import datetime,timezone,timedelta
from concurrent.futures import ThreadPoolExecutor

TW_P='https://openapi.twse.com.tw/v1/announcement/punish'
TP_P='https://www.tpex.org.tw/openapi/v1/tpex_disposal_information'
TP_N='https://www.tpex.org.tw/openapi/v1/tpex_trading_warning_information'

def iso(value):
    digits=re.sub(r'\D','',str(value))
    if len(digits)==7:return f'{int(digits[:3])+1911:04d}-{digits[3:5]}-{digits[5:7]}'
    if len(digits)==8:return f'{digits[:4]}-{digits[4:6]}-{digits[6:8]}'
    raise ValueError('Invalid official date '+str(value))

def minutes(text):
    matches=re.findall(r'每\s*([0-9０-９一二三四五六七八九十百兩]+)\s*分鐘\s*撮合',text)
    values=[]
    nums={'一':1,'二':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9}
    for raw in matches:
        try:n=int(raw)
        except ValueError:
            n=(nums.get(raw.split('十')[0],1)*10+nums.get(raw.split('十')[-1],0)) if '十' in raw else nums.get(raw)
        if n and n not in values:values.append(n)
    return values

def get(url):
    with urllib.request.urlopen(url,timeout=45) as r:return json.load(r)

def update(root,public,quote_date):
    notice_url='https://www.twse.com.tw/rwd/zh/announcement/notice?response=json&startDate='+quote_date.replace('-','')+'&endDate='+quote_date.replace('-','')
    urls=[TW_P,notice_url,TP_P,TP_N]
    with ThreadPoolExecutor(max_workers=4) as pool:tw_p,tw_n,tp_p,tp_n=list(pool.map(get,urls))
    if not all(isinstance(x,list) for x in [tw_p,tp_p,tp_n]) or tw_n.get('stat') not in ['OK','很抱歉，沒有符合條件的資料!']:raise ValueError('Invalid regulatory feeds')
    stocks={}
    def add(code,kind,value):
        if re.fullmatch(r'\d{4}',code):stocks.setdefault(code,{'attention':[],'disposals':[]})[kind].append(value)
    for r in tw_n.get('data',[]):add(str(r[1]).strip(),'attention',{'date':iso(r[5]),'source':notice_url})
    for r in tp_n:
        if r.get('Date'):add(r['SecuritiesCompanyCode'].strip(),'attention',{'date':iso(r['Date']),'source':TP_N})
    for rows,source,codekey,detailkey in [(tw_p,TW_P,'Code','Detail'),(tp_p,TP_P,'SecuritiesCompanyCode','DisposalCondition')]:
        for r in rows:
            if not r.get(codekey,'').strip():continue
            period=r.get('DispositionPeriod','');parts=re.split(r'[～~至]',period)
            if len(parts)!=2:raise ValueError('Unknown official disposal period '+period)
            text=r.get(detailkey,'')
            add(r[codekey].strip(),'disposals',{'start':iso(parts[0]),'end':iso(parts[1]),'announcement_date':iso(r['Date']),'minutes':minutes(text),'detail':text,'source':source})
    now=datetime.now(timezone(timedelta(hours=8)))
    data={'updated_at':now.isoformat(),'as_of':now.date().isoformat(),'quote_date':quote_date,'stocks':stocks,'sources':urls}
    target=public/'regulatory-data.json';temp=public/'regulatory-data.json.tmp'
    temp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8');os.replace(temp,target)
    return data

"""Public daily institutional trades; all published share counts converted to lots."""
import json,urllib.request,time
TWSE='https://www.twse.com.tw/rwd/zh/fund/T86?response=json&selectType=ALLBUT0999'
TPEX='https://www.tpex.org.tw/openapi/v1/tpex_3insti_daily_trading'
def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(url,timeout=45) as r:return json.load(r)
        except Exception:
            if i==2:raise
            time.sleep(2)
def number(x):return float(str(x).replace(',',''))/1000
def date(s):return f'{s[:4]}-{s[4:6]}-{s[6:]}'
def update(root,public,offline=False):
    if offline:data=json.loads((root/'institutional-seed.json').read_text(encoding='utf-8'))
    else:
        listed=get(TWSE);otc=get(TPEX)
        if listed.get('stat')!='OK' or len(listed.get('data',[]))<500 or len(otc)<500:raise ValueError('Incomplete institutional report')
        stocks={}
        for r in listed['data']:
            stocks[r[0].strip()]={'date':date(listed['date']),'foreign':{'buy':number(r[2]),'sell':number(r[3]),'net':number(r[4])},'trust':{'buy':number(r[8]),'sell':number(r[9]),'net':number(r[10])},'dealer':{'buy':number(r[12])+number(r[15]),'sell':number(r[13])+number(r[16]),'net':number(r[11])},'total':number(r[18])}
        for raw in otc:
            r={k.strip():v for k,v in raw.items()};d=r['Date'];d=str(int(d[:3])+1911)+d[3:]
            groups={}
            prefixes={'foreign':'Foreign Investors include Mainland Area Investors (Foreign Dealers excluded)','trust':'SecuritiesInvestmentTrustCompanies','dealer':'Dealers'}
            for name,prefix in prefixes.items():groups[name]={key:number(r[prefix+'-'+suffix]) for key,suffix in [('buy','Total Buy' if name=='foreign' else 'TotalBuy'),('sell','Total Sell' if name=='foreign' else 'TotalSell'),('net','Difference')]}
            stocks[r['SecuritiesCompanyCode'].strip()]={'date':date(d),**groups,'total':number(r['TotalDifference'])}
        data={'stocks':stocks,'sources':[TWSE,TPEX]}
    (public/'institutional-data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    return data

"""Small, date-aligned institutional and TDCC metrics for CB underlying stocks."""
import gzip,json
from pathlib import Path

def update(root,public):
    market=json.loads(gzip.decompress((public/'market-data.json.gz').read_bytes()))
    institutional=json.loads((public/'institutional-data.json').read_text(encoding='utf-8'))
    ownership=json.loads((public/'ownership-data.json').read_text(encoding='utf-8'))
    bonds=json.loads((public/'convertible-data.json').read_text(encoding='utf-8'))['bonds']
    codes={str(b.get('underlying_code')) for b in bonds if b.get('underlying_code')}
    stocks={s['code']:s for s in market['stocks'] if s['code'] in codes}
    weeks=ownership.get('weeks',[])
    result={}
    for code,stock in stocks.items():
        bars={b['date']:b for b in stock['bars']}
        history={h['date']:h for h in institutional.get('stocks',{}).get(code,{}).get('daily_history',[])}
        dates=[d for d in institutional.get('report_dates',[]) if d in bars and d in history][:20]
        net=sum(history[d]['total'] for d in dates)
        volume=sum(bars[d]['volume'] for d in dates)
        current=weeks[-1] if weeks else None
        prior=weeks[-5] if len(weeks)>=5 else None
        current_rate=current.get('stocks',{}).get(code,{}).get('400') if current else None
        prior_rate=prior.get('stocks',{}).get(code,{}).get('400') if prior else None
        result[code]={
            'institutionalPercent':round(net/volume*100,4) if len(dates)==20 and volume>0 else None,
            'institutionalDates':[dates[-1],dates[0]] if len(dates)==20 and volume>0 else None,
            'holderDeltaPp':round(current_rate-prior_rate,2) if isinstance(current_rate,(int,float)) and isinstance(prior_rate,(int,float)) else None,
            'holderDates':[prior['date'],current['date']] if isinstance(current_rate,(int,float)) and isinstance(prior_rate,(int,float)) else None,
        }
    data={'stocks':result,'marketDate':max((b['date'] for s in stocks.values() for b in s['bars'][-1:]),default=None)}
    payload=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    (root/'cb-chip-seed.json').write_text(payload,encoding='utf-8')
    (public/'cb-chip-data.json').write_text(payload,encoding='utf-8')
    return data

if __name__=='__main__':
    root=Path(__file__).resolve().parent
    update(root,root/'dist')


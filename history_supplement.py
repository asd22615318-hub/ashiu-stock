"""Merge verified historical bars without replacing newer official quote rows."""
import json
from pathlib import Path
def merge(data,root):
    path=Path(root)/'history-supplement.json'
    if not path.exists():return data
    supplemental=json.loads(path.read_text(encoding='utf-8'))
    lookup={stock['code']:stock for stock in supplemental.get('stocks',[])}
    for stock in data.get('stocks',[]):
        extra=lookup.get(stock['code'])
        if not extra or not stock.get('bars'):continue
        last=stock['bars'][-1]['date']
        bars={b['date']:b for b in extra.get('bars',[]) if b['date']<=last}
        bars.update({b['date']:b for b in stock['bars']})
        stock['bars']=[bars[date] for date in sorted(bars)][-520:]
        stock['history_source']=supplemental.get('source')
    if 'history_backfill' in data:data['history_backfill']['history_ready']=sum(len(s['bars'])>=361 for s in data['stocks'])
    return data
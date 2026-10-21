"""Collect the public HiStock underlying warrant rankings, without inferring trader identity."""
import json,re,html,urllib.request
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent
URL='https://histock.tw/stock/warrantstats.aspx'
GROUPS={'gCall_Desc':'認購買超','gCall':'認購賣超','gPut_Desc':'認售買超','gPut':'認售賣超'}
def parse(source):
    date=re.search(r'id="lUpdateTime"[^>]*>(\d{4}/\d{2}/\d{2})',source)
    if not date: raise ValueError('Missing report date')
    groups=[]
    for key,label in GROUPS.items():
        table=re.search(r'<table\b[^>]*id="'+key+r'"[^>]*>(.*?)</table>',source,re.S)
        if not table: raise ValueError('Missing table '+key)
        rows=[]
        for tr in re.findall(r'<tr\b[^>]*>(.*?)</tr>',table[1],re.S):
            cells=[html.unescape(re.sub('<[^>]+>','',s)).strip() for s in re.findall(r'<td\b[^>]*>(.*?)</td>',tr,re.S)]
            if not cells: continue
            if len(cells)!=9: raise ValueError('Changed columns')
            nums=[(float(s.replace(',','').replace('%','')) if s else None) for s in cells[3:]]
            if not re.fullmatch(r'[A-Z0-9]{4,7}',cells[1]): raise ValueError('Invalid code')
            if ('Desc' in key and nums[0]<0) or ('Desc' not in key and nums[0]>0): raise ValueError('Unexpected direction')
            rows.append(dict(rank=int(cells[0]),code=cells[1],name=cells[2],amount=nums[0],lots=nums[1],hedge=nums[2],outstanding=nums[3],buy_ratio=nums[4],dealer_ratio=nums[5]))
        if not 1<=len(rows)<=20: raise ValueError('Unexpected ranking size')
        groups.append(dict(key=key,label=label,rows=rows))
    return dict(version=1,date=date[1].replace('/','-'),source=URL,updated_at=datetime.now(timezone.utc).isoformat(),groups=groups)
if __name__=='__main__':
    import sys
    source=Path(sys.argv[1]).read_text(encoding='utf-8-sig') if len(sys.argv)>1 else urllib.request.urlopen(urllib.request.Request(URL,headers={'User-Agent':'Mozilla/5.0'}),timeout=40).read().decode('utf-8-sig')
    data=parse(source)
    target=ROOT/'warrant-seed.json'
    if target.exists() and json.loads(target.read_text(encoding='utf-8'))['date']>data['date']: raise ValueError('Refusing older snapshot')
    target.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(data['date'],[(g['label'],len(g['rows'])) for g in data['groups']])
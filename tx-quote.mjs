export const TX_SOURCE='https://mis.taifex.com.tw/futures/api/getQuoteList';
export function nearestQuote(raw,session){
 const rows=(raw?.RtData?.QuoteList||[]).flatMap(q=>{
  const match=/^TXF([A-L])(\d)-[FM]$/.exec(q.SymbolID||'');
  const date=String(q.CDate||''),time=String(q.CTime||'').padStart(6,'0'),price=Number(q.CLastPrice);
  if(!match||!/^\d{8}$/.test(date)||!/^\d{6}$/.test(time)||!q.CTime||!Number.isFinite(price)||price<=0)return [];
  const sourceYear=Number(date.slice(0,4));let year=Math.floor(sourceYear/10)*10+Number(match[2]);if(year<sourceYear-1)year+=10;
  const month=match[1].charCodeAt(0)-64,contract=year*100+month,reference=Number(q.CRefPrice);
  const numeric=v=>v!==''&&v!=null&&Number.isFinite(Number(v))?Number(v):null;
  const change=numeric(q.CDiff)??(reference>0?price-reference:null),pct=numeric(q.CDiffRate)??(reference>0&&change!==null?change/reference*100:null);
  return [{contract,price,change,change_pct:pct,source_date:date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6),source_time:time.slice(0,2)+':'+time.slice(2,4)+':'+time.slice(4),stamp:date+time,symbol:q.SymbolID,session,name:q.DispCName,status:q.Status,source:TX_SOURCE}];
 });
 rows.sort((a,b)=>a.contract-b.contract||b.stamp.localeCompare(a.stamp));return rows[0]||null;
}
export async function latestTxQuote(fetcher=fetch){
 const results=await Promise.allSettled(['0','1'].map(async market=>{
  const response=await fetcher(TX_SOURCE,{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'Mozilla/5.0',Accept:'application/json'},body:JSON.stringify({MarketType:market,SymbolType:'F',KindID:'1',CID:'TXF',ExpireMonth:'',RowSize:'全部',PageNo:'',SortColumn:'',AscDesc:'A'}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('期交所報價回應 '+response.status);
  return nearestQuote(await response.json(),market==='0'?'日盤':'夜盤');
 }));
 const quotes=results.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value);
 if(!quotes.length)throw Error('期交所目前沒有可用的近月成交報價');
 quotes.sort((a,b)=>b.stamp.localeCompare(a.stamp)||a.contract-b.contract);
 return {...quotes[0],retrieved_at:new Date().toISOString()};
}
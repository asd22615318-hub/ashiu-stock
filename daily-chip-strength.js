(function(root){
 'use strict';
 function percentiles(rows,key){
  const sorted=rows.slice().sort((a,b)=>a[key]-b[key]||a.code.localeCompare(b.code)),scores=new Map();
  for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j][key]===sorted[i][key])j++;const score=sorted.length===1?50:100*(i+j-1)/2/(sorted.length-1);for(let k=i;k<j;k++)scores.set(sorted[k].code,score);i=j;}return scores;
 }
 function calculate(stocks,ownership,institutions,snapshot,date){
  const weeks=(ownership?.weeks||[]).filter(w=>w.date<=date).slice().sort((a,b)=>a.date.localeCompare(b.date)),current=weeks.at(-1),prior=weeks.at(-2);
  const session=snapshot?.sessions?.find(s=>s.date===date),reported=(institutions?.report_dates||[]).includes(date),rows=new Map();
  for(const stock of stocks){
   const code=stock.code,bar=stock.bars.find(b=>b.date===date),flow=institutions?.stocks?.[code]?.daily_history?.find(h=>h?.date===date),branch=session?.stocks?.[code];
   const now=current?.stocks?.[code]?.['400'],old=prior?.stocks?.[code]?.['400'];
   const holderValid=Number.isFinite(now)&&Number.isFinite(old)&&now>=0&&now<=100&&old>=0&&old<=100&&!current.invalid_stocks?.[code]&&!prior.invalid_stocks?.[code];
   const volume=bar?.volume,volumeValid=Number.isFinite(volume)&&volume>0;
   const branchValid=branch?.date===date&&branch.unit==='lots'&&branch.top_n===15&&[branch.buy_lots,branch.sell_lots,branch.net_lots,branch.volume_lots].every(Number.isFinite)&&branch.buy_lots>=0&&branch.sell_lots>=0&&branch.volume_lots>0&&Math.abs(branch.buy_lots-branch.sell_lots-branch.net_lots)<=.01;
   const row={code,date,week:current?.date,priorWeek:prior?.date,holderNow:now,holderDelta:holderValid?Math.round((now-old)*100)/100:null,institutionalRatio:reported&&volumeValid&&Number.isFinite(flow?.total)?flow.total/volume*100:null,institutionalNet:reported&&Number.isFinite(flow?.total)?flow.total:null,brokerRatio:branchValid&&volumeValid?branch.net_lots/volume*100:null,score:null,missing:[]};
   if(!holderValid)row.missing.push(!current||!prior?'缺相鄰兩週集保資料':current.invalid_stocks?.[code]?'本週 '+current.date+' 集保資料異常':prior.invalid_stocks?.[code]?'前週 '+prior.date+' 集保資料異常':'相鄰週 400 張持股資料不足');
   if(!Number.isFinite(row.institutionalRatio))row.missing.push('當日法人或成交量資料不足');
   if(!Number.isFinite(row.brokerRatio))row.missing.push('當日分點或成交量資料不足');
   rows.set(code,row);
  }
  const complete=[...rows.values()].filter(r=>!r.missing.length),hs=percentiles(complete,'holderDelta'),bs=percentiles(complete,'brokerRatio'),is=percentiles(complete,'institutionalRatio');
  for(const row of complete)row.score=hs.get(row.code)*.4+bs.get(row.code)*.3+is.get(row.code)*.3;
  return {rows,complete:complete.length,date,week:current?.date,priorWeek:prior?.date};
 }
 const api={calculate,percentiles};if(typeof module==='object'&&module.exports)module.exports=api;root.dailyChipStrength=api;
})(typeof window==='undefined'?globalThis:window);
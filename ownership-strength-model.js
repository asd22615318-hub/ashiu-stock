(function(root){
 'use strict';
 function percentiles(rows,key){const sorted=rows.slice().sort((a,b)=>a[key]-b[key]||a.code.localeCompare(b.code)),out=new Map();for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j][key]===sorted[i][key])j++;const p=sorted.length===1?50:100*(i+j-1)/2/(sorted.length-1);for(let k=i;k<j;k++)out.set(sorted[k].code,p);i=j;}return out;}
 function calculate(stocks,ownership,institutional,weekDate){
  const weeks=(ownership?.weeks||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)),index=weeks.findIndex(w=>w.date===weekDate),current=weeks[index],prior=weeks[index-1],rows=new Map();if(!prior||!current)return {rows,complete:0,reason:'需要相鄰兩週集保資料'};
  const dates=[...new Set(stocks.flatMap(s=>s.bars.filter(b=>b.date>prior.date&&b.date<=current.date).map(b=>b.date)))].sort();
  const published=new Set(institutional?.report_dates||[]),allReports=dates.length>0&&dates.every(d=>published.has(d));
  for(const s of stocks){
   const now=current.stocks?.[s.code]?.['400'],old=prior.stocks?.[s.code]?.['400'];
   const r={code:s.code,from:prior.date,to:current.date,holderNow:now,holderDelta:Number.isFinite(now)&&Number.isFinite(old)&&now>=0&&now<=100&&old>=0&&old<=100&&!current.invalid_stocks?.[s.code]&&!prior.invalid_stocks?.[s.code]?Math.round((now-old)*100)/100:null,holderIssue:current.invalid_stocks?.[s.code]?`本週 ${current.date} 集保資料異常`:prior.invalid_stocks?.[s.code]?`前週 ${prior.date} 集保資料異常`:!Number.isFinite(now)?`本週 ${current.date} 無持股資料`:!Number.isFinite(old)?`前週 ${prior.date} 無持股資料`:'',institutionalRatio:null,score:null};
   const bars=new Map(s.bars.map(b=>[b.date,b])),history=new Map((institutional?.stocks?.[s.code]?.daily_history||[]).filter(Boolean).map(b=>[b.date,b]));let volume=0,net=0,valid=allReports;
   for(const date of dates){const b=bars.get(date),h=history.get(date);if(!Number.isFinite(b?.volume)||b.volume<0||!Number.isFinite(h?.total)){valid=false;break;}volume+=b.volume;net+=h.total;}
   if(valid&&volume>0){r.institutionalNet=net;r.institutionalRatio=net/volume*100;r.volume=volume;}


   const now1000=current.stocks?.[s.code]?.['1000'],old1000=prior.stocks?.[s.code]?.['1000'];
   r.holder1000Now=now1000;
   r.holder1000Delta=Number.isFinite(now1000)&&Number.isFinite(old1000)&&now1000>=0&&now1000<=100&&old1000>=0&&old1000<=100&&!current.invalid_stocks?.[s.code]&&!prior.invalid_stocks?.[s.code]?Math.round((now1000-old1000)*100)/100:null;
   rows.set(s.code,r);
  }

  const complete=[...rows.values()].filter(r=>[r.holderDelta,r.institutionalRatio].every(Number.isFinite));
  const hs=percentiles(complete,'holderDelta'),is=percentiles(complete,'institutionalRatio');
  for(const r of rows.values()){
   if(Number.isFinite(r.holderDelta)&&Number.isFinite(r.institutionalRatio)){r.score=hs.get(r.code)*.5+is.get(r.code)*.5;r.scoreReason='';}
   else r.scoreReason=r.holderIssue||'同期法人或成交量資料不足';
  }
  return {rows,complete:complete.length,universe:stocks.length,dates,from:prior.date,to:current.date,reason:!allReports?'同期法人日報未齊':''};

 }
 const api={calculate,percentiles};if(typeof module==='object'&&module.exports)module.exports=api;root.ownershipStrengthModel=api;
})(typeof window==='undefined'?globalThis:window);
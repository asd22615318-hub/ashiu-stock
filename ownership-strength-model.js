(function(root){
 'use strict';
 function percentiles(rows,key){const sorted=rows.slice().sort((a,b)=>a[key]-b[key]||a.code.localeCompare(b.code)),out=new Map();for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j][key]===sorted[i][key])j++;const p=sorted.length===1?50:100*(i+j-1)/2/(sorted.length-1);for(let k=i;k<j;k++)out.set(sorted[k].code,p);i=j;}return out;}
 function calculate(stocks,ownership,institutional,broker,weekDate){
  const weeks=(ownership?.weeks||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)),index=weeks.findIndex(w=>w.date===weekDate),current=weeks[index],prior=weeks[index-1],rows=new Map();if(!prior||!current)return {rows,complete:0,reason:'需要相鄰兩週集保資料'};
  const dates=[...new Set(stocks.flatMap(s=>s.bars.filter(b=>b.date>prior.date&&b.date<=current.date).map(b=>b.date)))].sort();
  const period=broker?.periods?.find(p=>p.start===dates[0]&&p.end===dates.at(-1)&&JSON.stringify(p.dates)===JSON.stringify(dates));
  const published=new Set(institutional?.report_dates||[]),allReports=dates.length>0&&dates.every(d=>published.has(d));
  for(const s of stocks){
   const now=current.stocks?.[s.code]?.['400'],old=prior.stocks?.[s.code]?.['400'];
   const r={code:s.code,from:prior.date,to:current.date,holderNow:now,holderDelta:Number.isFinite(now)&&Number.isFinite(old)&&now>=0&&now<=100&&old>=0&&old<=100&&!current.invalid_stocks?.[s.code]&&!prior.invalid_stocks?.[s.code]?Math.round((now-old)*100)/100:null,institutionalRatio:null,brokerRatio:null,score:null};
   const bars=new Map(s.bars.map(b=>[b.date,b])),history=new Map((institutional?.stocks?.[s.code]?.daily_history||[]).filter(Boolean).map(b=>[b.date,b]));let volume=0,net=0,valid=allReports;
   for(const date of dates){const b=bars.get(date),h=history.get(date);if(!Number.isFinite(b?.volume)||b.volume<0||!Number.isFinite(h?.total)){valid=false;break;}volume+=b.volume;net+=h.total;}
   if(valid&&volume>0){r.institutionalNet=net;r.institutionalRatio=net/volume*100;r.volume=volume;}
   const b=period?.stocks?.[s.code];
   if(valid&&volume>0&&b&&b.start===dates[0]&&b.end===dates.at(-1)&&b.unit==='lots'&&b.top_n===15&&b.buyers?.length===15&&b.sellers?.length===15&&Number.isFinite(b.buy_lots)&&Number.isFinite(b.sell_lots)&&b.buy_lots>=0&&b.sell_lots>=0&&Number.isFinite(b.net_lots)&&Math.abs(b.net_lots-(b.buy_lots-b.sell_lots))<=.01){r.brokerNet=b.net_lots;r.brokerRatio=b.net_lots/volume*100;r.brokerSource=b.source;}
   rows.set(s.code,r);
  }
  const complete=[...rows.values()].filter(r=>[r.holderDelta,r.institutionalRatio,r.brokerRatio].every(Number.isFinite)),h=percentiles(complete,'holderDelta'),i=percentiles(complete,'institutionalRatio'),b=percentiles(complete,'brokerRatio');
  for(const r of complete){r.score=h.get(r.code)*.4+i.get(r.code)*.3+b.get(r.code)*.3;}
  return {rows,complete:complete.length,universe:stocks.length,dates,from:prior.date,to:current.date,reason:!allReports?'同期法人日報未齊':!period?'同期分點報表未齊':''};
 }
 const api={calculate,percentiles};if(typeof module==='object'&&module.exports)module.exports=api;root.ownershipStrengthModel=api;
})(typeof window==='undefined'?globalThis:window);
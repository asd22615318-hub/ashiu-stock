(function(root){
 'use strict';
 function percentiles(rows,key){const sorted=rows.slice().sort((a,b)=>a[key]-b[key]||a.code.localeCompare(b.code)),out=new Map();for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j][key]===sorted[i][key])j++;const p=sorted.length===1?50:100*(i+j-1)/2/(sorted.length-1);for(let k=i;k<j;k++)out.set(sorted[k].code,p);i=j;}return out;}
 function calculate(stocks,ownership,institutional,weekDate,broker){
  const weeks=(ownership?.weeks||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)),index=weeks.findIndex(w=>w.date===weekDate),current=weeks[index],prior=weeks[index-1],rows=new Map();if(!prior||!current)return {rows,complete:0,reason:'需要相鄰兩週集保資料'};
  const dates=[...new Set(stocks.flatMap(s=>s.bars.filter(b=>b.date>prior.date&&b.date<=current.date).map(b=>b.date)))].sort();
  const branchPeriod=broker?.periods?.find(p=>dates.length&&p.start===dates[0]&&p.end===dates.at(-1)&&JSON.stringify(p.dates)===JSON.stringify(dates));
  const published=new Set(institutional?.report_dates||[]),allReports=dates.length>0&&dates.every(d=>published.has(d));
  for(const s of stocks){
   const now=current.stocks?.[s.code]?.['400'],old=prior.stocks?.[s.code]?.['400'];
   const r={code:s.code,from:prior.date,to:current.date,holderNow:now,holderDelta:Number.isFinite(now)&&Number.isFinite(old)&&now>=0&&now<=100&&old>=0&&old<=100&&!current.invalid_stocks?.[s.code]&&!prior.invalid_stocks?.[s.code]?Math.round((now-old)*100)/100:null,holderIssue:current.invalid_stocks?.[s.code]?`本週 ${current.date} 集保資料異常`:prior.invalid_stocks?.[s.code]?`前週 ${prior.date} 集保資料異常`:!Number.isFinite(now)?`本週 ${current.date} 無持股資料`:!Number.isFinite(old)?`前週 ${prior.date} 無持股資料`:'',institutionalRatio:null,score:null};
   const bars=new Map(s.bars.map(b=>[b.date,b])),history=new Map((institutional?.stocks?.[s.code]?.daily_history||[]).filter(Boolean).map(b=>[b.date,b]));let volume=0,net=0,valid=allReports;
   for(const date of dates){const b=bars.get(date),h=history.get(date);if(!Number.isFinite(b?.volume)||b.volume<0||!Number.isFinite(h?.total)){valid=false;break;}volume+=b.volume;net+=h.total;}
   if(valid&&volume>0){r.institutionalNet=net;r.institutionalRatio=net/volume*100;r.volume=volume;}

   const branch=branchPeriod?.stocks?.[s.code],volumeBars=dates.map(date=>bars.get(date)),branchVolume=volumeBars.length&&volumeBars.every(b=>Number.isFinite(b?.volume)&&b.volume>=0)?volumeBars.reduce((sum,b)=>sum+b.volume,0):0;
   const branchValid=branch&&branch.start===dates[0]&&branch.end===dates.at(-1)&&branch.unit==='lots'&&branch.top_n===15&&branch.buyers?.length===15&&branch.sellers?.length===15&&Number.isFinite(branch.buy_lots)&&Number.isFinite(branch.sell_lots)&&branch.buy_lots>=0&&branch.sell_lots>=0&&Number.isFinite(branch.net_lots)&&Math.abs(branch.net_lots-(branch.buy_lots-branch.sell_lots))<=.01;
   r.brokerRatio=branchValid&&branchVolume>0?branch.net_lots/branchVolume*100:null;
   r.brokerNet=branchValid?branch.net_lots:null;
   r.brokerSource=branchValid?branch.source:null;
   r.brokerFrom=dates[0];r.brokerTo=dates.at(-1);
   r.brokerIssue=!broker?'分點資料尚未載入':!branchPeriod?'此期間分點報表尚未收錄':!branch?'此股同期分點資料尚未收錄':!branchValid?'分點報表不完整或合計無法核對':!branchVolume?'同期成交量資料不足':'';
   rows.set(s.code,r);
  }

  const shared=typeof module==='object'&&module.exports?require('./chipburst-radar.js'):root.chipburstModel;
  const burst=broker&&shared?shared.calculate(stocks,ownership,institutional,weekDate,broker):null;
  const scored=new Map((burst?.scoredRows||[]).map(r=>[r.code,r]));
  for(const s of stocks){
   const row=rows.get(s.code),match=scored.get(s.code);
   if(match){row.score=match.score;row.scoreReason='';continue;}
   row.scoreReason=row.holderIssue||(!Number.isFinite(row.institutionalRatio)?'同期法人或成交量資料不足':
    ['4155','6173'].includes(s.code)?'此股依既有設定未納入籌碼暴增評分母體':
    !(s.bars.at(-1)?.volume>500)?'最新成交量未大於 500 張':
    !(row.holderDelta>0)?'400 張持股比例未增加':
    !(row.institutionalNet>0)?'同期三大法人未淨買超':
    !broker?'籌碼暴增分點資料尚未載入':burst?.error||'同期分點資料不完整，或集中淨額未為正');
  }
  return {rows,complete:burst?.complete||0,eligible:burst?.eligible||0,universe:burst?.universe||stocks.length,dates,from:prior.date,to:current.date,reason:burst?.error||(!broker?'籌碼暴增分點資料尚未載入':'')};

 }
 const api={calculate,percentiles};if(typeof module==='object'&&module.exports)module.exports=api;root.ownershipStrengthModel=api;
})(typeof window==='undefined'?globalThis:window);
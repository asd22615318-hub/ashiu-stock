(function(root){
 'use strict';
 const finite=Number.isFinite,mean=a=>a.reduce((s,v)=>s+v,0)/a.length,max=a=>Math.max(...a),min=a=>Math.min(...a);
 const ma=(bars,n,end=bars.length)=>end>=n?mean(bars.slice(end-n,end).map(b=>b.close)):null;
 const pct=(a,b)=>(a/b-1)*100,round=v=>Math.round(v*100)/100;
 function withTradeValues(stock,values){
  return {...stock,bars:stock.bars.map(b=>{
   if(finite(b.amount)&&b.amount>0)return b;
   const amount=values?.dates?.[b.date]?.[stock.market]?.[stock.code],vwap=amount/(b.volume*1000);
   return finite(amount)&&amount>0&&finite(vwap)&&vwap>=b.low*.95&&vwap<=b.high*1.05?{...b,amount}:b;
  })};
 }
 function points(items){return {items,total:items.reduce((s,x)=>s+(x.pass===true?x.weight:0),0),pending:items.reduce((s,x)=>s+(x.pass===null?x.weight:0),0)};}
 const item=(name,weight,pass,detail)=>({name,weight,pass,detail});
 function percentile(rows,key){
  const sorted=rows.slice().sort((a,b)=>a[key]-b[key]);for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j][key]===sorted[i][key])j++;for(let k=i;k<j;k++)sorted[k][key+'Rank']=sorted.length===1?50:100*(i+j-1)/2/(sorted.length-1);i=j;}
 }
 function sectorRanks(stocks,groups,date){
  const byCode=new Map(stocks.map(s=>[s.code,s])),rows=[];
  for(const [name,codes] of groups||[]){
   const members=[...codes].map(c=>byCode.get(c)).filter(s=>s?.bars.at(-1)?.date===date&&s.bars.length>=2&&finite(s.bars.at(-1).close)&&s.bars.at(-2).close>0),eligible=members.filter(s=>s.bars.length>=6&&s.bars.slice(-6).every(b=>finite(b.volume)&&b.volume>0));
   if(eligible.length<3||eligible.length/Math.max(1,members.length)<.8)continue;
   const changes=members.map(s=>pct(s.bars.at(-1).close,s.bars.at(-2).close)),oldVolume=eligible.reduce((sum,s)=>sum+mean(s.bars.slice(-6,-1).map(b=>b.volume)),0);
   rows.push({name,codes,change:mean(changes),breadth:changes.filter(v=>v>0).length/changes.length*100,volume:eligible.reduce((sum,s)=>sum+s.bars.at(-1).volume,0)/oldVolume});
  }
  for(const key of ['change','breadth','volume'])percentile(rows,key);
  rows.forEach(r=>r.strength=r.changeRank*.5+r.breadthRank*.3+r.volumeRank*.2);rows.sort((a,b)=>b.strength-a.strength||b.change-a.change);
  const lookup=new Map();rows.forEach((r,i)=>{r.rank=i+1;for(const code of r.codes)if(!lookup.has(code))lookup.set(code,{name:r.name,rank:r.rank,strength:r.strength});});return lookup;
 }
 function holdings(ctx,code,date){
  const weeks=(ctx.ownership?.weeks||[]).filter(w=>w.date<=date).slice().sort((a,b)=>a.date.localeCompare(b.date)),last=weeks.slice(-3),values=last.map(w=>w.stocks?.[code]?.['400']);
  const good=last.map((w,i)=>finite(values[i])&&values[i]>=0&&values[i]<=100&&!w.invalid_stocks?.[code]);
  const delta=last.length>=2&&good.at(-1)&&good.at(-2)?round(values.at(-1)-values.at(-2)):null;
  const increasing=last.length===3&&good.every(Boolean)?values[1]>values[0]&&values[2]>values[1]&&round(values[2]-values[0])>=1:null;
  return {date:weeks.at(-1)?.date,from:last.at(-2)?.date,delta,increasing,totalChange:last.length===3&&good.every(Boolean)?round(values[2]-values[0]):null};
 }
 function report(ctx,code,dates){
  const p=ctx.broker?.periods?.find(p=>JSON.stringify(p.dates)===JSON.stringify(dates)),r=p?.stocks?.[code];
  return r&&r.start===dates[0]&&r.end===dates.at(-1)&&r.unit==='lots'&&r.top_n===15&&r.buyers?.length===15&&r.sellers?.length===15&&[r.buy_lots,r.sell_lots,r.net_lots].every(finite)&&r.buy_lots>=0&&r.sell_lots>=0&&Math.abs(r.buy_lots-r.sell_lots-r.net_lots)<=.01?r:null;
 }
 function dailyReport(ctx,code,date){
  const r=ctx.daily?.sessions?.find(s=>s.date===date)?.stocks?.[code];
  return r&&r.date===date&&r.unit==='lots'&&r.top_n===15&&[r.buy_lots,r.sell_lots,r.net_lots].every(finite)&&r.buy_lots>=0&&r.sell_lots>=0&&Math.abs(r.buy_lots-r.sell_lots-r.net_lots)<=.01?r:null;
 }
 function rs20(ctx,bars){
  const t=bars.at(-1),old=bars.at(-21),bm=new Map((ctx.benchmark?.rows||[]).map(b=>[b.d,b.i]));
  return old&&bm.get(t.date)>0&&bm.get(old.date)>0?pct(t.close,old.close)-pct(bm.get(t.date),bm.get(old.date)):null;
 }
 function common(stock,ctx){
  const bars=stock.bars,t=bars?.at(-1),reasons=[],flags=[];
  if(/金融|保險/.test(stock.industry||''))return {ok:false,reasons:['金融保險業，排除'],flags};
  if(!t||t.date!==ctx.date)return {ok:false,reasons:['行情非最新交易日／可能停牌'],flags};
  if(bars.length<61)return {ok:false,reasons:['日線不足 61 個交易日'],flags};
  const recent=bars.slice(-61);if(recent.some(b=>![b.open,b.high,b.low,b.close,b.volume].every(finite)||b.close<=0||b.open<=0||b.low<=0||b.volume<=0||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)))reasons.push('OHLCV 缺漏、零成交或價格異常');
  if(recent.some((b,i)=>i&&finite(b.quote_change_pct)&&Math.abs(pct(b.close,recent[i-1].close)-b.quote_change_pct)>3))reasons.push('疑似除權息／股本調整，價格尚待處理');
  const calendar=(ctx.benchmark?.rows||[]).map(b=>b.d).filter(d=>d<=ctx.date).slice(-61);
  if(calendar.length===61&&JSON.stringify(calendar)!==JSON.stringify(recent.map(b=>b.date)))reasons.push('交易日缺漏／曾停止交易');
  const v20=mean(bars.slice(-20).map(b=>b.volume)),amounts=bars.slice(-20).map(b=>b.amount);
  if(v20<1000)reasons.push('20 日均量未達 1,000 張');
  if(amounts.some(x=>!finite(x)||x<=0))reasons.push('20 日成交金額資料不足');
  else if(mean(amounts)<30000000)reasons.push('20 日平均成交額未達 3,000 萬元');
  if(t.close<=20)reasons.push('收盤須大於 20 元');
  if(t.close>ma(bars,20)*1.2)reasons.push('收盤高於 MA20 超過 20%');
  if(pct(t.close,bars.at(-6).close)>25)flags.push('近 5 日漲幅逾 25%，追高風險');
  const regulation=ctx.regulatory?.stocks?.[stock.code],active=regulation?.disposals?.filter(d=>d.start<=ctx.date&&d.end>=ctx.date)||[];
  if(active.length)reasons.push('處置期間，排除');
  if(stock.full_delivery||stock.suspended||stock.adjustment_pending)reasons.push('全額交割／停牌／股本調整待處理');
  if(!ctx.regulatory||ctx.regulatory.quote_date!==ctx.date)flags.push('當日處置公告待核對');
  flags.push('全額交割與重大事件須另核對');
  return {ok:!reasons.length,reasons,flags};
 }
 function evaluate(stock,ctx){
  const gate=common(stock,ctx);if(!gate.ok)return {code:stock.code,gate,radars:[]};
  const b=stock.bars,t=b.at(-1),p=b.at(-2),n=b.length,closes=b.map(b=>b.close),low5=min(b.slice(-5).map(b=>b.low)),oldLow5=min(b.slice(-10,-5).map(b=>b.low));
  const range=rows=>(max(rows.map(x=>x.high))/min(rows.map(x=>x.low))-1)*100;
  const range20=range(b.slice(-20)),m5=ma(b,5),m10=ma(b,10),m20=ma(b,20),m60=ma(b,60),up5=m5>ma(b,5,n-1),up10=m10>ma(b,10,n-1),up20=m20>ma(b,20,n-1);
  const prior20=b.slice(-21,-1),v20=mean(prior20.map(b=>b.volume)),v5=mean(b.slice(-5).map(b=>b.volume)),rvol=t.volume/v20,return20=pct(t.close,b.at(-21).close),strength=rs20(ctx,b),hold=holdings(ctx,stock.code,t.date),sector=ctx.sectors?.get(stock.code);
  const five=b.slice(-5),branch5=report(ctx,stock.code,five.map(b=>b.date)),volume5=five.reduce((s,b)=>s+b.volume,0),branchRatio=branch5?branch5.net_lots/volume5*100:null;
  const buyNets=branch5?.buyers?.map(r=>r.net_lots).filter(v=>finite(v)&&v>0).sort((a,b)=>b-a)||[],buySum=buyNets.reduce((s,v)=>s+v,0);
  const concentrated=branch5&&buySum>0?buyNets.slice(0,3).reduce((s,v)=>s+v,0)/buySum>=.5&&buyNets[0]/buySum<=.4:null;
  const daily=dailyReport(ctx,stock.code,t.date),radars=[],base={code:stock.code,name:stock.name,date:t.date,close:t.close,maScore:ctx.maScores?.get(stock.code)??null,flags:gate.flags,hold,rs20:strength,sector};
  if(range20<=25&&t.close/m60>=.9&&t.close/m60<=1.12&&low5>=oldLow5*.98&&v5<=v20*1.1&&return20<=25){
   const breaking=b.at(-1).low<b.at(-2).low&&b.at(-2).low<b.at(-3).low&&t.close<m10;
   if(!breaking){
    const contradiction=branchRatio!==null&&branchRatio>=5&&hold.delta!==null&&hold.delta<0;
    const score=points([item('集保籌碼',25,hold.increasing,'400 張占比連增兩期且累計 ≥1% 差值'),item('分點籌碼',20,branchRatio===null||concentrated===null?null:branchRatio>=5&&concentrated,'同一個前五日區間 BranchNet5 ≥5%；前三大占比 ≥50%、單一分點 ≤40%'),item('底部結構',25,low5>oldLow5&&range(b.slice(-10))<range(b.slice(-20,-10)),'近五日低點墊高，近十日振幅小於前十日'),item('量縮整理',15,v5<=v20*.8,'近五日均量 ≤ 前二十日均量 80%'),item('均線改善',15,up5&&m5>m10&&Math.abs(pct(t.close,m20))<=3,'MA5 上彎、MA5>MA10、收盤距 MA20 ±3%')]);
    radars.push({...base,type:'A',state:contradiction?'籌碼矛盾觀察':'吸籌候選',score,priority:!contradiction&&score.total>=75,status:contradiction?'籌碼矛盾，不列吸籌':score.total>=85?'優先研究':score.total>=75?'吸籌觀察':score.pending?'條件符合，評分待核對':'未達 75 分',facts:{range20,ma60Ratio:t.close/m60,low5,oldLow5,rvol,return20,branchRatio},contradiction});
   }
  }
  const hc20=max(prior20.map(b=>b.close)),hh20=max(prior20.map(b=>b.high)),formal=t.close>=hc20*.995&&rvol>=1.5&&m5>=m10&&t.close>=m20&&return20<=30;
  const early=!formal&&t.close<hc20*.995&&t.close>=hc20*.97&&rvol>=1.2&&up5&&return20<=30;
  if(formal||early){
   const orderedVolumes=prior20.map(b=>b.volume).sort((a,b)=>a-b);
   const score=points([item('平台突破',30,t.close>=hh20*1.01,'收盤突破前二十日最高價 ≥1%（入選另採最高收盤價 HC20）'),item('量能攻擊',25,rvol>=2&&t.volume>orderedVolumes[14],'RVOL ≥2 且高於前二十日成交量第 75 百分位'),item('均線排列',15,m5>m10&&m10>m20&&up5&&up10&&up20,'MA5>MA10>MA20，三線上彎'),item('籌碼確認',15,!daily||hold.delta===null?null:daily.net_lots>0&&hold.delta>=-.2,'當日分點淨額為正，400 張占比週減不超過 0.2% 差值'),item('族群強度',15,!sector||strength===null?null:sector.rank<=5&&strength>5,'熱門細分族群資金強度前五，RS20>5% 差值')]);
   radars.push({...base,type:'B',state:early?'提前觀察':'正式發動候選',score,priority:formal&&score.total>=80,status:early?'提前觀察，未正式發動':score.total>=80?'優先觀察':score.total>=65?'候選':score.pending?'條件符合，評分待核對':'未達 65 分',facts:{hc20,hh20,rvol,return20},early});
  }
  // Confirm a closing-price swing high with two bars on each side, available now.
  for(let peak=n-6;peak>=Math.max(20,n-21);peak--){
   const ph=b[peak].close;if(!b.slice(peak-2,peak).concat(b.slice(peak+1,peak+3)).every(x=>ph>x.close))continue;
   let start=-1;for(let k=peak-20;k<=peak-5;k++)if(k>=0&&(start<0||b[k].close<b[start].close))start=k;
   if(start<0||pct(ph,b[start].close)<12)continue;
   const pull=b.slice(peak+1,-1);if(!pull.length)continue;
   const pl=min(pull.map(x=>x.close)),pullIndex=peak+1+pull.findIndex(x=>x.close===pl),retrace=(ph-pl)/(ph-b[start].close),attack=b.slice(start,peak+1),attackVolume=mean(attack.map(x=>x.volume)),pullVolume=mean(pull.map(x=>x.volume));
   if(retrace<.2||retrace>.65||pullVolume>attackVolume*.75||t.close<pl)continue;
   const trigger=(p.close<=ma(b,5,n-1)&&t.close>m5)||t.close>p.high;
   const pullHigh=max(pull.map(x=>x.close)),nearPull=[ma(b,5,pullIndex+1),ma(b,10,pullIndex+1)].some(m=>finite(m)&&Math.abs(pct(pl,m))<=3);
   const attackReport=report(ctx,stock.code,attack.map(x=>x.date)),pullReport=report(ctx,stock.code,pull.map(x=>x.date));let retained=null;
   if(attackReport&&pullReport){
    const leaders=attackReport.buyers.slice(0,3),flows=new Map(pullReport.buyers.map(r=>[r.name,r.net_lots]));
    for(const r of pullReport.sellers)flows.set(r.name,-r.net_lots);
    if(leaders.every(r=>flows.has(r.name)))retained=leaders.reduce((s,r)=>s+flows.get(r.name),0)>=-leaders.reduce((s,r)=>s+r.net_lots,0)*.3;
   }
   const score=points([item('前波強度',15,strength===null?null:pct(ph,b[start].close)>=15&&strength>0,'前波漲幅 ≥15%、RS20>0'),item('回檔品質',25,nearPull&&retrace<=.65,'回檔低點距當時 MA5 或 MA10 ±3%，回撤不超過 65%'),item('量縮程度',20,pullVolume<=attackVolume*.6,'回檔均量 ≤ 攻擊期均量 60%'),item('再攻確認',25,trigger&&t.close>pullHigh&&rvol>=1.5,'收盤突破回檔最高收盤價，RVOL≥1.5'),item('籌碼續強',15,retained,'原攻擊期前三大買超分點，回檔合計淨賣不超過原淨買 30%；需完整同區間報表')]);
   radars.push({...base,type:'C',state:trigger?'TRIGGERED｜已轉強':'SETUP｜等待突破',score,priority:trigger&&score.total>=80,status:!trigger?'等待轉強，不與已發動混列':score.total>=80?'優先觀察':score.pending?'已轉強，評分待核對':'已轉強，未達 80 分',facts:{ph,pl,peakDate:b[peak].date,baseDate:b[start].date,waveGain:pct(ph,b[start].close),retrace:retrace*100,pullRatio:pullVolume/attackVolume,rvol,pullHigh},trigger});
   break;
  }
  return {code:stock.code,gate,radars};
 }
 const api={evaluate,common,holdings,sectorRanks,points,report,rs20,withTradeValues};if(typeof module==='object'&&module.exports)module.exports=api;root.featuredRadarModel=api;
})(typeof window==='undefined'?globalThis:window);
(function(root){
 'use strict';
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
 function ma(bars,i,n){return i>=n-1?mean(bars.slice(i-n+1,i+1).map(b=>b.close)):null;}
 function score(bars,i){
  if(i<360)return null;
  const t=bars[i],stand=[5,10,20,60,120,240].map(n=>t.close>=ma(bars,i,n)),fresh=[5,10,20,60,120,360].map(n=>t.close>Math.max(...bars.slice(i-n,i-2).map(b=>b.close))),order=[[20,60],[60,120],[120,360]].map(([a,b])=>ma(bars,i,a)>ma(bars,i,b));
  return [...stand,...fresh,...order].filter(Boolean).length;
 }
 function evaluate(bars,date){
  if(!Array.isArray(bars)||bars.length<371||bars.at(-1).date!==date)return null;
  const i=bars.length-1,t=bars[i];if(bars.some(b=>![b.close,b.high,b.low,b.volume].every(Number.isFinite)||b.close<=0||b.low<=0))return null;
  const todayScore=score(bars,i),priorScores=Array.from({length:10},(_,n)=>score(bars,i-10+n));
  if(priorScores.some(x=>x===null))return null;
  const maxPriorScore=Math.max(...priorScores),prior20=bars.slice(i-20,i),prior60=bars.slice(i-60,i),range=(Math.max(...prior20.map(b=>b.high))-Math.min(...prior20.map(b=>b.low)))/bars[i-1].close*100;
  const high=n=>Math.max(...bars.slice(i-n,i).map(b=>b.high)),new20=t.close>high(20),new60=t.close>high(60);
  const rise20=(t.close/Math.min(...bars.slice(i-19,i+1).map(b=>b.low))-1)*100,rise60=(t.close/Math.min(...bars.slice(i-59,i+1).map(b=>b.low))-1)*100;
  let highCount=0;for(let k=i-9;k<=i;k++)if(bars[k].close>Math.max(...bars.slice(k-60,k).map(b=>b.high)))highCount++;
  const m20=ma(bars,i,20),gap=(t.close/m20-1)*100;
  const turn=n=>ma(bars,i,n)>ma(bars,i-1,n)&&Array.from({length:10},(_,k)=>i-k).some(k=>ma(bars,k,n)>ma(bars,k-1,n)&&ma(bars,k-1,n)<=ma(bars,k-2,n));
  const recentCross=n=>t.close>ma(bars,i,n)&&Array.from({length:10},(_,k)=>i-k).some(k=>bars[k].close>ma(bars,k,n)&&bars[k-1].close<=ma(bars,k-1,n));
  const turns=turn(20)&&turn(60),cross60=recentCross(60),cross120=recentCross(120),v20=mean(prior20.map(b=>b.volume)),v5=mean(bars.slice(i-5,i).map(b=>b.volume)),volumeRatio=v20>0?t.volume/v20:null,contraction=v20>0?v5/v20:null;
  const checks={scoreJump:todayScore>=10&&maxPriorScore<10,platform:range<20&&(new20||new60),earlyGain:rise20<25&&rise60<40,fewBreakouts:highCount<=2,maState:t.close>=m20&&gap<10&&(turns||cross60||cross120),volume:volumeRatio!==null&&volumeRatio>1.5&&contraction<1};
  return {passes:Object.values(checks).every(Boolean),checks,todayScore,maxPriorScore,range,rise20,rise60,highCount,gap,volumeRatio,contraction,new20,new60,turns,cross60,cross120};
 }
 const api={evaluate,score};if(typeof module==='object'&&module.exports)module.exports=api;root.launchModel=api;
})(typeof window==='undefined'?globalThis:window);
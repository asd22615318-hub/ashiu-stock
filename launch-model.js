(function(root){
 'use strict';
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
 function ma(bars,i,n){return i>=n-1?mean(bars.slice(i-n+1,i+1).map(b=>b.close)):null;}
 function score(bars,i){if(i<360)return null;const t=bars[i],stand=[5,10,20,60,120,240].map(n=>t.close>=ma(bars,i,n)),fresh=[5,10,20,60,120,360].map(n=>t.close>Math.max(...bars.slice(i-n,i-2).map(b=>b.close))),order=[[20,60],[60,120],[120,360]].map(([a,b])=>ma(bars,i,a)>ma(bars,i,b));return [...stand,...fresh,...order].filter(Boolean).length;}
 function evaluate(bars,date,strength=null){
  if(!Array.isArray(bars)||bars.length<361||bars.at(-1).date!==date)return null;
  const i=bars.length-1,t=bars[i],prev=bars[i-1];if(bars.some(b=>![b.close,b.high,b.low,b.volume].every(Number.isFinite)||b.close<=0||b.low<=0))return null;
  const todayScore=score(bars,i),high20=Math.max(...bars.slice(i-20,i).map(b=>b.high)),previousHigh=Math.max(...bars.slice(i-21,i-1).map(b=>b.high));
  const volume5=mean(bars.slice(i-5,i).map(b=>b.volume)),volumeRatio=volume5>0?t.volume/volume5:null,m20=ma(bars,i,20),m60=ma(bars,i,60),gap=(t.close/m20-1)*100;
  const stock5=Number.isFinite(strength?.stock5)?strength.stock5:null,rs5=Number.isFinite(strength?.rs5)?strength.rs5:null;
  const firstLow=Math.min(...bars.slice(i-9,i-4).map(b=>b.low)),secondLow=Math.min(...bars.slice(i-4,i+1).map(b=>b.low)),rangeHigh=Math.max(...bars.slice(i-9,i+1).map(b=>b.high)),rangeLow=Math.min(firstLow,secondLow),rangeSize=rangeHigh-rangeLow,rangePosition=rangeSize>0?(t.close-rangeLow)/rangeSize:null;
  const checks={risingBase:secondLow>firstLow&&rangePosition!==null&&rangePosition>=0.8,score:todayScore>=7,trend:t.close>m20&&t.close>m60&&m20>ma(bars,i-1,20),relative:rs5!==null&&rs5>0,notExtended:gap<=10&&stock5!==null&&stock5<=15,liquidity:t.close>=20&&t.volume>500};
  return {passes:Object.values(checks).every(Boolean),checks,todayScore,high20,volumeRatio,gap,stock5,rs5,firstLow,secondLow,rangeHigh,rangeLow,rangePosition};
 }
 const api={evaluate,score};if(typeof module==='object'&&module.exports)module.exports=api;root.launchModel=api;
})(typeof window==='undefined'?globalThis:window);
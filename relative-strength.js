/* Return differences are percentage points, not RSI or a price ratio. */
(function(root){
 'use strict';
 function calculate(bars,benchmark,asOf){
  if(!Array.isArray(bars)||!Array.isArray(benchmark)||!bars.length)return null;
  const dates=new Map();
  for(const r of benchmark){if(r.d&&Number.isFinite(r.i)&&r.i>0)dates.set(r.d,r.i);}
  const market=[...dates].sort((a,b)=>a[0].localeCompare(b[0]));
  const latest=bars.at(-1).date;
  if(asOf&&latest!==asOf)return null;
  const end=market.findIndex(r=>r[0]===latest);
  if(end<20)return null;
  const closes=new Map(bars.map(b=>[b.date,b.close]));
  const window=market.slice(end-20,end+1);
  if(window.some(([d])=>!Number.isFinite(closes.get(d))||closes.get(d)<=0))return null;
  const current=closes.get(latest),ret=n=>(current/closes.get(market[end-n][0])-1)*100;
  const marketRet=n=>(market[end][1]/market[end-n][1]-1)*100;
  const stock20=ret(20),stock5=ret(5),market20=marketRet(20),market5=marketRet(5);
  const rs20=stock20-market20,rs5=stock5-market5;
  return {date:latest,stock20,stock5,market20,market5,rs20,rs5,passes:rs20>8+1e-9&&rs5>1e-9};
 }
 if(typeof module==='object'&&module.exports)module.exports={calculate};
 if(typeof window==='undefined')return;
 let rows=null,pending=null,cache=new WeakMap();
 root.marketStrength={calculate,status:'尚未載入',
  get(stock,asOf){let entry=cache.get(stock);if(!entry||entry.asOf!==asOf){entry={asOf,value:calculate(stock.bars,rows,asOf)};cache.set(stock,entry);}return entry.value;},
  load(){if(rows)return Promise.resolve();if(pending)return pending;
   this.status='加權指數載入中…';
   pending=fetch('taiwan-sentiment-data.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(data=>{
    if(!Array.isArray(data.rows)||data.rows.filter(r=>Number.isFinite(r.i)&&r.i>0).length<21)throw Error('指數歷史不足');
    rows=data.rows;cache=new WeakMap();this.status='加權指數資料已載入';
   }).catch(()=>{this.status='加權指數讀取失敗，取消後重新勾選可重試；未以缺漏資料判定。';}).finally(()=>{pending=null;window.dispatchEvent(new Event('market-strength-ready'));});return pending;
  }
 };
})(typeof window==='undefined'?globalThis:window);

(function(){
 'use strict';
 const fee=0.001425,tax=0.003;
 function netReturn(entry,exit){return (exit*(1-fee-tax)/(entry*(1+fee))-1)*100;}
 function evaluate(bars,index,days,calendar){
  const signalDate=bars[index].date,pos=calendar.indexOf(signalDate),entryDate=calendar[pos],exitDate=calendar[pos+days];
  if(pos<0||!entryDate||!exitDate)return {status:'pending'};
  const dates=new Map(bars.map(b=>[b.date,b]));
  const entry=dates.get(entryDate),exit=dates.get(exitDate);
  if(!entry||!exit||calendar.slice(pos+1,pos+days+1).some(d=>!dates.has(d)))return {status:'missing'};
  if(!Number.isFinite(entry.close)||entry.close<=0||!Number.isFinite(exit.close)||exit.close<=0)return {status:'missing'};
  return {status:'complete',value:netReturn(entry.close,exit.close),entryDate,exitDate};
 }
 if(typeof module==='object'&&module.exports){module.exports={netReturn,evaluate};return;}
 const root=document.getElementById('pattern-backtest-content'),toggle=document.getElementById('pattern-backtest-toggle');if(!root||!toggle)return;
 let running=false,token=0;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number.isFinite(v)?v.toFixed(2):'—';
 toggle.addEventListener('click',()=>{root.hidden=!root.hidden;toggle.setAttribute('aria-expanded',String(!root.hidden));toggle.textContent=root.hidden?'展開型態回測 ▾':'收合型態回測 ▴';});
 function setup(){root.innerHTML='<p>近三個月訊號 · 訊號當日收盤價模擬尾盤進場 · 持有 5／10／20 個交易日。</p><button id="pattern-backtest-run" class="ghost" type="button">開始回測</button><p id="pattern-backtest-progress" role="status"></p><div id="pattern-backtest-results"></div>';root.querySelector('button').onclick=run;}
 async function run(){
  if(running)return;if(typeof records==='undefined'||mode!=='live'||!records.length){root.querySelector('#pattern-backtest-progress').textContent='請先載入正式盤後個股資料。';return;}
  running=true;const own=++token,button=root.querySelector('button'),progress=root.querySelector('#pattern-backtest-progress');button.disabled=true;
  try{
   const response=await fetch('taiwan-sentiment-data.json',{cache:'no-cache'});if(!response.ok)throw Error('交易日資料無法讀取');const data=await response.json();
   const sourceRecords=records,asOf=records.map(s=>s.bars.at(-1)?.date||'').sort().at(-1),calendar=[...new Set(data.rows.filter(x=>x.d<=asOf&&Number.isFinite(x.i)).map(x=>x.d))].sort();
   if(calendar.at(-1)!==asOf)throw Error('大盤交易日尚未更新至個股最新日期，請待資料同步後再試。');
   const end=new Date(asOf+'T00:00:00Z'),day=end.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()-3);const maxDay=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();end.setUTCDate(Math.min(day,maxDay));const start=end.toISOString().slice(0,10);
   const results=TYPES.map(([key,name])=>({key,name,signals:0,stocks:new Set(),horizons:[5,10,20].map(days=>({days,returns:[],pending:0,missing:0}))}));
   const p={score:0,volPeriod:5,shrinkRatio:1,burstRatio:2,tolerance:2.5,highPeriod:20,wick:40};let unavailable=0,errors=0;
   for(let n=0;n<sourceRecords.length;n++){
    if(own!==token)return;const stock=sourceRecords[n],bars=stock.bars;let usable=false;
    for(let i=20;i<bars.length;i++){
     const bar=bars[i];if(bar.date<start||bar.date>asOf||bar.close<20||bar.volume<=500)continue;
     // Only data known on the signal date reaches the existing pattern detector.
     let signal;try{signal=analyze({...stock,bars:bars.slice(0,i+1)},p).signals;}catch(e){errors++;continue;}usable=true;
     for(const r of results){if(!signal[r.key])continue;r.signals++;r.stocks.add(stock.code);
      for(const h of r.horizons){const outcome=evaluate(bars,i,h.days,calendar);if(outcome.status==='complete')h.returns.push(outcome.value);else h[outcome.status]++;}
     }
    }
    if(!usable)unavailable++;
    if(n%4===0){progress.textContent=`回測中 ${n+1}／${sourceRecords.length} 檔…`;await new Promise(resolve=>setTimeout(resolve,0));}
   }
   if(own!==token)return;
   root.querySelector('#pattern-backtest-results').innerHTML=`<p>訊號期間 ${esc(start)}～${esc(asOf)} · ${sourceRecords.length} 檔現有股票資料 · 未產生可判斷樣本 ${unavailable} 檔 · 判斷失敗 ${errors} 次</p><p>勝率＝扣成本報酬率 ＞ 0 的完成筆數／完成筆數。買賣手續費各 0.1425%、賣出交易稅 0.3%，不計折扣；訊號日為第 0 日，進場後第 N 個交易日收盤出場。不限目前選股篩選條件，固定訊號日股價 ≥ 20 元、量 ＞ 500 張，沿用目前型態預設參數。</p><div class="chipburst-table-wrap"><table class="chipburst-table"><thead><tr><th>型態</th><th>訊號／個股數</th>${[5,10,20].map(d=>`<th>${d} 日扣成本勝率／平均報酬</th>`).join('')}</tr></thead><tbody>${results.map(r=>`<tr><td>${esc(r.name.replace('候選',''))}</td><td>${r.signals}／${r.stocks.size}</td>${r.horizons.map(h=>{const count=h.returns.length,win=h.returns.filter(v=>v>0).length,mean=count?h.returns.reduce((a,b)=>a+b,0)/count:null;return `<td><strong>${count?fmt(win/count*100)+'%':'無完成樣本'}</strong><small>平均 ${fmt(mean)}% · ${win} 勝／${count} 筆</small><small>待完成 ${h.pending} · 缺資料 ${h.missing}${count>0&&count<30?' · 樣本偏少':''}</small></td>`;}).join('')}</tr>`).join('')}</tbody></table></div><details><summary>回測限制與樣本計法</summary><p>每個符合日各算一筆；同股連續訊號、不同型態重疊可重複計入，並非獨立交易組合。只用訊號當日以前資料判斷；未到出場日列待完成，停牌或缺交易日列缺資料，不用最後價格代替。此為現有股票與已載入歷史的回測，含存續偏誤；資料不足時長週期型態可能漏判，未另補退市股。完整日 K 型態需收盤才能確認，同一收盤價進場屬理想化假設，存在收盤確認與成交時點偏差，並非收盤前可確定成交。未建模漲停買不到、跌停賣不出、滑價、除權息及交易成本最低收費；平均報酬不是年化或投資組合績效。</p></details>`;
   progress.textContent='回測完成。';
  }catch(e){progress.textContent='回測未完成：'+e.message;}finally{running=false;button.disabled=false;}
 }
 window.addEventListener('stock-data-ready',()=>{token++;running=false;setup();});setup();
})();
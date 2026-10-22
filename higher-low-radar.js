(function(){
 'use strict';
 function signal(bars,benchmark,asOf){
  if(!Array.isArray(bars)||bars.length<35||bars.at(-1).date!==asOf)return null;
  const n=bars.length-1,t=bars[n],avg=i=>i<19?null:bars.slice(i-19,i+1).reduce((s,b)=>s+b.close,0)/20;
  const lows=[];
  for(let i=3;i<=n-3;i++)if(bars.slice(i-3,i).every(b=>bars[i].low<b.low)&&bars.slice(i+1,i+4).every(b=>bars[i].low<b.low))lows.push(i);
  if(lows.length<2)return null;
  const a=lows.at(-2),b=lows.at(-1);
  if(b-a<2||bars[b].low<=bars[a].low||bars.slice(b+1).some(x=>x.low<bars[b].low))return null;
  const high=Math.max(...bars.slice(a+1,b).map(x=>x.high));
  // Both bottoms must have been confirmed before a crossover can qualify.
  let cross=-1;
  for(let i=Math.max(b+3,20);i<=n;i++)if(bars[i-1].close<=avg(i-1)&&bars[i].close>avg(i))cross=i;
  const market=benchmark.filter(x=>Number.isFinite(x.i)&&x.i>0).slice().sort((x,y)=>x.d.localeCompare(y.d));
  const end=market.findIndex(x=>x.d===asOf),closes=new Map(bars.map(x=>[x.date,x.close]));
  let rs=null,previous=null;
  if(end>=6&&market.slice(end-6,end+1).every(x=>Number.isFinite(closes.get(x.d))&&closes.get(x.d)>0)){
   const value=i=>(closes.get(market[i].d)/closes.get(market[i-5].d)-market[i].i/market[i-5].i)*100;
   rs=value(end);previous=value(end-1);
  }
  const above=cross>=0&&t.close>avg(n),strong=rs!==null&&rs>0&&rs>previous;
  let breakout=-1;
  if(above)for(let i=cross;i<=n;i++)if(bars[i].close>high&&bars[i-1].close<=high)breakout=i;
  const stage=above&&breakout>=0&&t.close>high&&strong?'突破發動':above?'站回月線':'底部墊高';
  return {stage,low1:bars[a].low,low2:bars[b].low,low1Date:bars[a].date,low2Date:bars[b].date,confirmed:bars[b+3].date,high,ma20:avg(n),cross:cross<0?null:bars[cross].date,breakout:breakout<0?null:bars[breakout].date,rs,previous,strong};
 }
 if(typeof module==='object'&&module.exports){module.exports={signal};return;}
 const root=document.getElementById('higher-low-content');if(!root)return;
 const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
 let benchmark=null,error='',filter='突破發動';
 const toggle=document.getElementById('higher-low-toggle');toggle.addEventListener('click',()=>{root.hidden=!root.hidden;toggle.setAttribute('aria-expanded',String(!root.hidden));toggle.textContent=root.hidden?'展開轉強名單 ▾':'收合轉強名單 ▴';if(!root.hidden)render();});
 function render(){
  if(typeof analyses==='undefined'||!analyses.length){root.textContent='等待個股日線資料…';return;}
  if(!benchmark){root.textContent=error||'正在載入加權指數歷史…';return;}
  if(typeof mode!=='undefined'&&mode!=='live'){root.textContent='請先載入盤後真實行情；示範資料不列入雷達。';return;}
  const date=analyses.map(s=>s.t.date).sort().at(-1),items=[];
  for(const stock of analyses){if(stock.t.close<20||stock.t.volume<=500)continue;const result=signal(stock.bars,benchmark,date);if(result)items.push({stock,...result});}
  const selected=items.filter(x=>filter==='全部階段'||x.stage===filter).sort((a,b)=>(b.rs??-Infinity)-(a.rs??-Infinity)||(b.stock.score??-1)-(a.stock.score??-1));
  root.innerHTML=`<p>行情日期 ${esc(date)} · ${selected.length} 檔符合所選階段</p><p>順序：已確認的兩個波段低點墊高 → 收盤由下穿越 MA20 → 收盤突破兩底之間的前高。突破發動另須 RS5 ＞ 0 且高於前一交易日；RS5＝個股近 5 日報酬率－加權指數同期報酬率。</p><details><summary>判斷規則</summary><p>轉折低點須嚴格低於左右各 3 根日 K，右側完成才確認；穿越 MA20 須發生在第二底確認當日或之後。跌破第二底撤銷這組訊號。股價至少 20 元、成交量大於 500 張；依最新個股日期篩選。缺漏指數或日期不齊不判定相對轉強。這是候選觀察，尚未完成歷史績效驗證。</p></details><label class="field">訊號階段<select id="higher-low-stage">${['突破發動','站回月線','底部墊高','全部階段'].map(x=>`<option ${x===filter?'selected':''}>${x}</option>`).join('')}</select></label><div class="chipburst-table-wrap"><table class="chipburst-table"><thead><tr><th>個股／階段</th><th>收盤／均線分數</th><th>第一底 → 第二底</th><th>前高／MA20</th><th>近 5 日勝大盤</th><th>確認／訊號日期</th></tr></thead><tbody>${selected.map(x=>`<tr><td><button type="button" data-higher-low="${esc(x.stock.code)}">${esc(x.stock.name)} ${esc(x.stock.code)}</button><small>${x.stage}</small></td><td>${fmt(x.stock.t.close)}<small style="color:#ffb36e">均線 ${x.stock.score==null?'待補':x.stock.score+' / 15'}</small></td><td>${fmt(x.low1)} → ${fmt(x.low2)}<small>${x.low1Date} → ${x.low2Date}</small></td><td>${fmt(x.high)}／${fmt(x.ma20)}</td><td style="color:${x.strong?'#ff647b':'#ffffff'}">${x.rs===null?'資料不足':(x.rs>0?'+':'')+fmt(x.rs)+' 個百分點'}<small>${x.strong?'相對轉強':x.rs===null?'待指數資料':'未符合相對轉強'}</small></td><td>第二底確認 ${x.confirmed}<small>穿 MA20 ${esc(x.cross)}</small><small>突破 ${esc(x.breakout)}</small></td></tr>`).join('')}</tbody></table></div>${selected.length?'':'<p>目前沒有符合此階段的個股。</p>'}`;
  root.querySelector('select').addEventListener('change',e=>{filter=e.target.value;render();});
  root.querySelectorAll('[data-higher-low]').forEach(b=>b.addEventListener('click',()=>{const stock=analyses.find(s=>s.code===b.dataset.higherLow);if(stock)openStockDetail(stock,b);}));
 }
 window.addEventListener('stock-data-ready',()=>{if(!root.hidden)render();});
 fetch('taiwan-sentiment-data.json',{cache:'no-cache'}).then(async r=>{if(!r.ok)throw Error('指數資料讀取失敗');return r.json();}).then(d=>{if(!Array.isArray(d.rows))throw Error('指數格式不符');benchmark=d.rows;render();}).catch(e=>{error=e.message;render();});
})();
(function(){
 'use strict';
 const valid=v=>Number.isFinite(v)&&v>0;
 function drawdown(values){
  if(values.length!==60||!values.every(valid))return null;
  let peak=values[0],worst=0;for(const v of values){peak=Math.max(peak,v);worst=Math.max(worst,(1-v/peak)*100);}return worst;
 }
 function relative(bars,market,date){
  const end=market.findIndex(x=>x.d===date),prices=new Map(bars.map(x=>[x.date,x.close]));
  if(end<5||!market.slice(end-5,end+1).every(x=>valid(x.i)&&valid(prices.get(x.d))))return null;
  return (prices.get(date)/prices.get(market[end-5].d)-market[end].i/market[end-5].i)*100;
 }
 function analyze(bars,market,date){
  if(!Array.isArray(bars)||bars.length<60||bars.at(-1).date!==date)return null;
  const n=bars.length-1,ma=i=>i>=19?bars.slice(i-19,i+1).reduce((s,x)=>s+x.close,0)/20:null;
  const recentDates=market.slice(-60).map(x=>x.d),byDate=new Map(bars.map(x=>[x.date,x.close]));
  const fall=drawdown(recentDates.map(d=>byDate.get(d))),rs=relative(bars,market,date);
  const base={fall,rs,above:valid(ma(n))&&bars[n].close>ma(n),ma20:ma(n)};
  const lows=[];for(let i=3;i<=n-3;i++)if(bars.slice(i-3,i).every(x=>bars[i].close<x.close)&&bars.slice(i+1,i+4).every(x=>bars[i].close<x.close))lows.push(i);
  if(lows.length<2)return {...base,pattern:null};
  const a=lows.at(-2),b=lows.at(-1);
  if(bars[b].close/bars[a].close<1.01-1e-10||bars.slice(b+1).some(x=>x.close<bars[b].close))return {...base,pattern:null};
  let cross=-1;for(let i=Math.max(b+3,20);i<=n;i++)if(bars[i-1].close<=ma(i-1)&&bars[i].close>ma(i))cross=i;
  const high=Math.max(...bars.slice(a+1,b).map(x=>x.close));
  let breakout=-1;for(let i=b+3;i<=n;i++)if(bars[i].close>high&&bars[i-1].close<=high)breakout=i;
  const mean=breakout>=5?bars.slice(breakout-5,breakout).reduce((s,x)=>s+x.volume,0)/5:null;
  return {...base,pattern:{low1:bars[a].close,low2:bars[b].close,date1:bars[a].date,date2:bars[b].date,confirmed:bars[b+3].date,cross:cross<0?null:bars[cross].date,high,breakout:breakout<0?null:bars[breakout].date,volumeRatio:mean>0?bars[breakout].volume/mean:null}};
 }
 function peerStrength(code,groups,states){
  return [...groups].filter(([,members])=>members.has(code)).map(([name,members])=>{
   const eligible=[...members].filter(c=>states.has(c)),strong=eligible.filter(c=>states.get(c).above&&states.get(c).rs>0);
   const others=strong.filter(c=>c!==code).length,ratio=eligible.length?strong.length/eligible.length:0;
   return {name,total:members.size,valid:eligible.length,strong:strong.length,others,passes:eligible.length>=3&&strong.length>=3&&others>=2&&ratio>=0.5};
  }).sort((a,b)=>Number(b.passes)-Number(a.passes)||b.strong/b.valid-a.strong/a.valid||b.strong-a.strong)[0]||null;
 }
 if(typeof module==='object'&&module.exports){module.exports={drawdown,relative,analyze,peerStrength};return;}
 const root=document.getElementById('higher-low-content');if(!root)return;
 const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
 let benchmark=null,error='',filter='轉強確認';
 const toggle=document.getElementById('higher-low-toggle');toggle.addEventListener('click',()=>{root.hidden=!root.hidden;toggle.setAttribute('aria-expanded',String(!root.hidden));toggle.textContent=root.hidden?'展開轉強名單 ▾':'收合轉強名單 ▴';if(!root.hidden)render();});
 function render(){
  if(typeof analyses==='undefined'||!analyses.length){root.textContent='等待個股日線資料…';return;}
  if(!benchmark){root.textContent=error||'正在載入大盤歷史…';return;}
  if(mode!=='live'){root.textContent='請先載入盤後真實行情。';return;}
  const date=analyses.map(s=>s.t.date).sort().at(-1),market=benchmark.filter(x=>x.d<=date&&valid(x.i)).sort((a,b)=>a.d.localeCompare(b.d));
  const marketFall=market.at(-1)?.d===date?drawdown(market.slice(-60).map(x=>x.i)):null,crash=marketFall!==null&&marketFall>15+1e-9;
  const states=new Map();for(const stock of analyses){const result=analyze(stock.bars,market,date);if(result)states.set(stock.code,result);}
  const groups=typeof window.getHotSectorGroups==='function'?window.getHotSectorGroups():new Map(),items=[];
  if(crash)for(const stock of analyses){const s=states.get(stock.code);if(!s?.pattern||!(s.fall>20)||!(s.rs>0)||stock.t.close<20||stock.t.volume<=500)continue;
   const peer=peerStrength(stock.code,groups,states),cross=!!s.pattern.cross&&s.above,stage=cross&&peer?.passes?'轉強確認':'提前觀察';
   items.push({stock,...s,peer,stage,missing:[...(!cross?['等待收盤穿 MA20 並維持其上']:[]),...(!peer?.passes?['等待族群同步轉強']:[])]});
  }
  const selected=items.filter(x=>filter==='全部候選'||x.stage===filter).sort((a,b)=>(b.stock.score??-1)-(a.stock.score??-1)||(a.stock.rank??Infinity)-(b.stock.rank??Infinity)||a.stock.code.localeCompare(b.stock.code));
  root.innerHTML=`<p><strong>大盤重挫條件：${marketFall===null?'資料不足':crash?'符合':'未符合'}</strong> · 近 60 交易日最大回落 ${fmt(marketFall)}% · 行情日期 ${esc(date)}</p><p>${marketFall===null?'需有同日大盤及完整 60 日歷史，暫不判定。':crash?'大盤曾重挫超過 15%，已啟用跌後轉強篩選。':'大盤近 60 日未曾回落超過 15%，本策略暫無候選，並非資料未載入。'}</p><details><summary>六項條件與計算方式</summary><p>① 大盤近 60 交易日曾由較早高點回落超過 15%；② 個股同期間收盤最大回落超過 20%；③ 最近兩個收盤波段低點，第二底至少高 1%，左右各 3 日確認，之後收盤跌破第二底撤銷；④ 第二底確認後收盤由下穿越 MA20，最新仍站上；⑤ 個股近五日報酬率優於加權指數（RS5 ＞ 0）；⑥ 同細分族群至少 3 檔且半數以上站上 MA20、RS5 ＞ 0，排除本股後至少仍有 2 檔。</p><p>族群分母採同日且具足夠歷史的有效成員，另列完整成員數；沿用熱門細分族群，多重歸屬取優先符合者。股價至少 20 元、量大於 500 張。跌回 MA20 下方降為觀察。前高突破、突破量比 ＞ 1.3、RS5 ≥ 3 為加分標記，不再是必要條件。未完成歷史績效驗證。</p></details><label class="field">訊號階段<select id="higher-low-stage">${['轉強確認','提前觀察','全部候選'].map(x=>`<option ${x===filter?'selected':''}>${x}</option>`).join('')}</select></label><p>${selected.length} 檔 · 依均線分數由高到低排序</p><div class="chipburst-table-wrap"><table class="chipburst-table"><thead><tr><th>個股／階段</th><th>收盤／均線分數</th><th>60 日最大回落</th><th>兩底收盤價</th><th>MA20 狀態</th><th>RS5</th><th>族群轉強比例</th><th>尚缺條件／加分</th></tr></thead><tbody>${selected.map(x=>`<tr><td><button data-higher-low="${esc(x.stock.code)}">${esc(x.stock.name)} ${esc(x.stock.code)}</button><small>${x.stage}</small></td><td>${fmt(x.stock.t.close)}<small style="color:#ffb36e">均線 ${x.stock.score==null?'待補':x.stock.score+' / 15'}</small></td><td>${fmt(x.fall)}%</td><td>${fmt(x.pattern.low1)} → ${fmt(x.pattern.low2)}<small>${x.pattern.date1} → ${x.pattern.date2}</small><small>第二底確認 ${x.pattern.confirmed}</small></td><td>${x.above?'站上':'跌破或未站上'} ${fmt(x.ma20)}<small>穿越日 ${esc(x.pattern.cross)}</small></td><td>${x.rs>0?'+':''}${fmt(x.rs)} 個百分點</td><td>${x.peer?`${esc(x.peer.name)}<small>${x.peer.strong}／${x.peer.valid} 檔轉強 · 全部 ${x.peer.total} 檔</small><small>其他轉強 ${x.peer.others} 檔</small>`:'尚無細分族群資料'}</td><td>${x.missing.length?x.missing.map(esc).join('、'):'六項符合'}<small>加分：${[x.stock.t.close>x.pattern.high&&x.pattern.breakout?'突破收盤前高':'',x.pattern.volumeRatio>1.3?'突破量比 '+fmt(x.pattern.volumeRatio)+' 倍':'',x.rs>=3?'RS5 ≥ 3':''].filter(Boolean).join('、')||'—'}</small></td></tr>`).join('')}</tbody></table></div>${selected.length?'':'<p>目前沒有符合此階段的個股。</p>'}`;
  root.querySelector('select').addEventListener('change',e=>{filter=e.target.value;render();});root.querySelectorAll('[data-higher-low]').forEach(b=>b.addEventListener('click',()=>{const s=analyses.find(x=>x.code===b.dataset.higherLow);if(s)openStockDetail(s,b);}));
 }
 window.addEventListener('stock-data-ready',()=>{if(!root.hidden)render();});
 fetch('taiwan-sentiment-data.json',{cache:'no-cache'}).then(async r=>{if(!r.ok)throw Error('指數載入失敗');return r.json();}).then(d=>{if(!Array.isArray(d.rows))throw Error('指數格式不符');benchmark=d.rows;render();}).catch(e=>{error=e.message;render();});
})();
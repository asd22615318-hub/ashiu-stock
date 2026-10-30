(() => {
 'use strict';
 const root=document.getElementById('featured-radar');if(!root)return;
 const shell=root.querySelector('details'),content=root.querySelector('.chipburst-info');
 let tab='A',view='all',query='',cstate='all',limit=30,loaded=false,loading=false,results=null,loadErrors=[];
 const snapshots={},esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—',signed=v=>Number.isFinite(v)?(v>0?'+':'')+fmt(v):'—';
 const titles={A:'A｜主力吸籌',B:'B｜主力準備發動',C:'C｜主力洗盤再攻'};
 const rules={
 A:'A1：近20日最高價／最低價−1 ≤25%。A2：收盤／MA60 介於0.90～1.12。A3：近5日最低價 ≥ 前5日最低價98%。A4：近5日均量 ≤ 前20日均量1.10倍。另排除20日漲幅>25%，以及連續3日破低且收盤未站回MA10。',
 B:'B1：收盤 ≥ 前20日最高收盤價 HC20 ×0.995（不含當日）。B2：RVOL ≥1.5。B3：MA5 ≥MA10、收盤 ≥MA20。B4：20日報酬 ≤30%。提前觀察另列：未達B1、距HC20不超過3%、RVOL≥1.2、MA5上彎，不能當作正式訊號。紅K、黑K均可。',
 C:'PH：距今5～20個交易日，左右各2根已完成K棒確認的收盤轉折高。前波起點取PH前5～20日最低收盤。C1：前波漲幅≥12%。C2：(PH−PL)／(PH−前波起點)介於20%～65%。C3：回檔均量≤攻擊期75%。C4：今日收盤由下向上穿MA5，或收盤突破昨日最高價。C1～C3符合且尚未達C4，列SETUP；C4成立列TRIGGERED。今日收盤不得再跌破PL。'
 };
 const style=document.createElement('style');style.textContent='#featured-radar .fr-controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}#featured-radar .fr-controls input{flex:1;min-width:140px;padding:10px;background:#0d1726;border:1px solid #705331;border-radius:8px;color:white;font:inherit}#featured-radar .fr-controls select{width:auto;max-width:100%;margin:0}#featured-radar .fr-tabs{display:flex;gap:8px;flex-wrap:wrap}#featured-radar .fr-tabs button{padding:10px 14px;border:1px solid #806a3a;border-radius:8px;background:#183c35;color:#f3f4f6;font:inherit;cursor:pointer}#featured-radar .fr-tabs button[aria-selected=true]{background:#6c4c1f;color:#ffe298;border-color:#ffe298}#featured-radar .fr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:14px;margin-top:16px}#featured-radar .fr-card{border:1px solid #705331;border-radius:12px;padding:16px;min-width:0;overflow-wrap:anywhere;background:#201824}#featured-radar .fr-name{border:0;background:none;padding:0;color:#ffe298;font-weight:800;font-size:19px;cursor:pointer;text-align:left}#featured-radar .fr-card p{color:#eee7ee;line-height:1.8;font-size:14px}#featured-radar .fr-card .fr-orange{color:#ffb36e;font-weight:700}#featured-radar .fr-status{display:inline-block;padding:4px 8px;border:1px solid #6f7564;border-radius:7px;margin:6px 5px 6px 0;color:#ffe298;font-size:13px}#featured-radar .fr-score{display:flex;align-items:center;gap:10px;margin:10px 0;flex-wrap:wrap}#featured-radar .fr-track{flex:1;min-width:60px;height:11px;background:#392f41;border-radius:8px;overflow:hidden;display:flex}#featured-radar .fr-track i{display:block;height:100%;background:#ffe298}#featured-radar .fr-track em{display:block;height:100%;background:repeating-linear-gradient(45deg,#665c6b,#665c6b 3px,#423b47 3px,#423b47 6px)}#featured-radar .fr-score strong{color:#ffe298}#featured-radar .fr-note{font-size:13px;line-height:1.9;color:#cdd6df}#featured-radar .fr-score-row{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #493d36;padding:8px 0;font-size:14px}#featured-radar .fr-warning{color:#ffb36e!important}#featured-radar details>summary{white-space:normal}#featured-radar .fr-common{border:1px solid #604b64;padding:12px;border-radius:9px;margin:12px 0}#featured-radar button:focus-visible{outline:2px solid #ffe298;outline-offset:3px}';document.head.appendChild(style);
 async function load(){
  if(loading||loaded)return;loading=true;content.innerHTML='<p>正在比對行情、集保、分點與族群資料…</p>';
  await Promise.all([['ownership','ownership-data.json'],['broker','broker-data.json'],['daily','broker-daily-data.json'],['benchmark','taiwan-sentiment-data.json'],['regulatory','regulatory-data.json'],['tradeValues','featured-trade-values-data.json']].map(async([key,file])=>{
   try{const response=await fetch(file,{cache:'no-cache'});if(!response.ok)throw Error('HTTP '+response.status);snapshots[key]=await response.json();}catch(e){loadErrors.push(key+'：'+e.message);}
  }));
  loaded=true;loading=false;recalculate();
 }
 function recalculate(){
  if(!loaded||!shell.open)return;
  if(typeof records==='undefined'||typeof mode==='undefined'||mode!=='live'||!records.length){content.innerHTML='<p>請先載入官方盤後行情。</p>';return;}
  const date=records.map(s=>s.bars?.at(-1)?.date||'').sort().at(-1),groups=window.getHotSectorGroups?.()||new Map();
  const ctx={...snapshots,date,sectors:window.featuredRadarModel.sectorRanks(records,groups,date),maScores:new Map((typeof analyses==='undefined'?[]:analyses).map(s=>[s.code,s.score]))};
  const entries=records.map(stock=>window.featuredRadarModel.evaluate(window.featuredRadarModel.withTradeValues(stock,snapshots.tradeValues),ctx));
  results={date,entries,rows:entries.flatMap(s=>s.radars),excluded:entries.filter(s=>!s.gate.ok).length};limit=30;render();
 }
 function facts(r){
  const f=r.facts;
  if(r.type==='A')return '20日振幅 '+fmt(f.range20)+'% · 收盤／MA60 '+fmt(f.ma60Ratio)+' · 近5日低 '+fmt(f.low5)+'／前5日低 '+fmt(f.oldLow5)+' · 20日漲幅 '+signed(f.return20)+'%';
  if(r.type==='B')return 'HC20 '+fmt(f.hc20)+' · HH20 '+fmt(f.hh20)+' · RVOL '+fmt(f.rvol)+' 倍 · 20日報酬 '+signed(f.return20)+'%';
  return 'PH '+fmt(f.ph)+'（'+esc(f.peakDate)+'） · PL '+fmt(f.pl)+' · 前波漲幅 '+fmt(f.waveGain)+'% · 回撤 '+fmt(f.retrace)+'% · 回檔／攻擊均量 '+fmt(f.pullRatio*100)+'% · RVOL '+fmt(f.rvol)+' 倍';
 }
 function card(r){
  const score=r.score;
  return '<article class="fr-card"><button class="fr-name" type="button" data-fr-stock="'+esc(r.code)+'">'+esc(r.name)+' '+esc(r.code)+' ↗</button><p class="fr-orange">收盤 '+fmt(r.close)+' 元 · 均線 '+(r.maScore==null?'待齊':r.maScore+' / 15')+'</p><span class="fr-status">'+esc(r.state)+'</span><span class="fr-status">'+esc(r.status)+'</span><div class="fr-score" role="img" aria-label="已確認 '+score.total+' 分，'+score.pending+' 分待核對"><span class="fr-track"><i style="width:'+score.total+'%"></i><em style="width:'+score.pending+'%"></em></span><strong>'+score.total+' / 100</strong></div><p class="fr-note">'+(score.pending?'已確認 '+score.total+' 分；另 '+score.pending+' 分資料待核對，不當成未符合或0分。':'資料完整，依各項條件加總。')+'</p><p>'+facts(r)+'</p><p>集保 '+esc(r.hold.from||'—')+' → '+esc(r.hold.date||'—')+' · 400張週增 '+(r.hold.delta===null?'無法比較':signed(r.hold.delta)+'%')+'<br>RS20 '+(r.rs20===null?'資料待齊':signed(r.rs20)+'% 差值')+' · '+(r.sector?esc(r.sector.name)+' 族群資金強度 #'+r.sector.rank:'族群尚無有效排名')+'</p><p class="fr-warning">'+r.flags.map(esc).join(' · ')+'</p><details><summary>評分明細與判斷</summary>'+score.items.map(x=>'<div class="fr-score-row"><span>'+esc(x.name)+'</span><strong>'+(x.pass===null?'待核對 / '+x.weight:(x.pass?x.weight:0)+' / '+x.weight)+'</strong></div><p class="fr-note">'+esc(x.detail)+'</p>').join('')+'</details></article>';
 }
 function render(){
  if(!results)return;
  const all=results.rows.filter(r=>r.type===tab),text=query.trim().toLowerCase();
  const filtered=all.filter(r=>(!text||(r.code+' '+r.name).toLowerCase().includes(text))&&(view==='all'||view==='priority'&&r.priority||view==='pending'&&r.score.pending>0)&&(!(tab==='C'&&cstate!=='all')||(cstate==='setup'?!r.trigger:r.trigger))).sort((a,b)=>(b.maScore??-1)-(a.maScore??-1)||b.score.total-a.score.total||a.code.localeCompare(b.code));
  content.innerHTML='<div class="fr-tabs" role="tablist" aria-label="精選股雷達">'+Object.keys(titles).map(k=>'<button type="button" role="tab" data-fr-tab="'+k+'" aria-selected="'+(tab===k)+'">'+titles[k]+' · '+results.rows.filter(r=>r.type===k).length+'</button>').join('')+'</div><p class="fr-note">行情日期 '+esc(results.date)+' · 共用條件排除 '+results.excluded+' 檔 · 入選是資料條件候選，並非已確認主力吸籌或買進指令。</p>'+(loadErrors.length?'<p class="fr-warning">部分來源未載入：'+loadErrors.map(esc).join('；')+'。相關評分保留待核對。</p>':'')+'<form class="fr-controls"><input id="fr-query" type="search" aria-label="搜尋精選股代號或名稱" placeholder="股票代號／名稱" value="'+esc(query)+'"><button type="submit" class="ghost">確認</button><select id="fr-view" aria-label="評分狀態"><option value="all" '+(view==='all'?'selected':'')+'>全部條件候選</option><option value="priority" '+(view==='priority'?'selected':'')+'>優先／吸籌觀察</option><option value="pending" '+(view==='pending'?'selected':'')+'>評分資料待核對</option></select>'+(tab==='C'?'<select id="fr-cstate" aria-label="洗盤再攻狀態"><option value="all">全部狀態</option><option value="setup" '+(cstate==='setup'?'selected':'')+'>SETUP 等待突破</option><option value="triggered" '+(cstate==='triggered'?'selected':'')+'>TRIGGERED 已轉強</option></select>':'')+'</form><details class="fr-common"><summary>'+titles[tab]+'｜入選公式、共用排除與量化定義</summary><p>'+rules[tab]+'</p><p class="fr-note">共用：20日均量 ≥1,000張、20日平均成交額 ≥3,000萬元、收盤 ≥10元；收盤距MA20不高於20%。近5日漲幅>25%只標記追高風險；處置、停牌、全額交割已知狀態排除。缺OHLCV、零成交、缺20日金額、最新交易日不符或已知股本調整待處理，不評分。未接齊的全額交割、增減資與重大事件另標記須核對，不視為已通過。每日漲幅與官方參考漲幅差異>3%差值，視為股本／價格事件待處理。均線含當日；RVOL=今日量／前20日均量（不含今日）；共用20日均量及金額含今日；股價結構、C波段與突破確認以收盤價計，A區間振幅及最低價依圖採高低價。族群資金強度沿用熱門細分族群的當日均漲50%＋上漲比例30%＋量能20%的排名。三項均線上彎採當日均線>前日均線。</p><p class="fr-note">未明訂條件的本版量化：接近均線為±3%；A底部收斂為近10日振幅小於前10日；分點集中為前三大淨買超占前15大合計≥50%、單一分點≤40%；B大戶未明顯下降為週減≤0.2%差值；C主要分點反向賣超不超過原淨買30%。BranchNet5須同一前5日報表，不能把每天不同前15名合計當成同一組分點。C原攻擊分點未出現在回檔前15名時，不能當作沒有賣超。這些未明訂門檻可再調整。</p><p class="fr-note">A：已確認≥75分為吸籌觀察，≥85優先研究；B：≥80優先，65～79候選；C：TRIGGERED且≥80優先，SETUP另列等待。總分固定100；缺資料列待核對分，不補零、不重新放大其他分數。400張已包含千張，不重複計分。集保增減數字以%顯示比例差值（42%→43%為+1%差值，非相對成長1%）。</p></details><h3>'+titles[tab]+' · '+filtered.length+' 檔 · 均線分數由高到低</h3><div class="fr-grid">'+(filtered.slice(0,limit).map(card).join('')||'<p>目前沒有符合此雷達及顯示條件的個股。可切換其他雷達或評分狀態。</p>')+'</div>'+(filtered.length>limit?'<button type="button" class="ghost" id="fr-more">再顯示30檔（尚有 '+(filtered.length-limit)+' 檔）</button>':'');
  content.querySelectorAll('[data-fr-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.frTab;limit=30;render();});
  content.querySelector('form').onsubmit=e=>{e.preventDefault();query=content.querySelector('#fr-query').value;limit=30;render();};
  content.querySelector('#fr-view').onchange=e=>{view=e.target.value;limit=30;render();};
  content.querySelector('#fr-cstate')?.addEventListener('change',e=>{cstate=e.target.value;limit=30;render();});
  content.querySelector('#fr-more')?.addEventListener('click',()=>{limit+=30;render();});
  content.querySelectorAll('[data-fr-stock]').forEach(button=>button.onclick=()=>{const stock=typeof analyses==='undefined'?null:analyses.find(s=>s.code===button.dataset.frStock);if(stock)openStockDetail(stock,button);});
 }
 shell.addEventListener('toggle',()=>{if(shell.open){if(!loaded)load();else recalculate();}});
 window.addEventListener('stock-data-ready',()=>{if(shell.open)loaded?recalculate():load();});
 window.addEventListener('cb-chip-data-ready',()=>{if(shell.open&&loaded)recalculate();});
 if(shell.open)load();
})();
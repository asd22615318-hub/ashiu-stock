(() => {
 'use strict';
 const root=document.getElementById('ownership-stock-search');if(!root)return;
 let selectedCode='',message='輸入股票代號或名稱，按確認查看 400 張以上綜合籌碼。';
 const cache=new Map();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
 const signed=v=>Number.isFinite(v)?(v>0?'+':'')+fmt(v)+'%':'待補';
 function result(date){
  if(!cache.has(date))cache.set(date,window.ownershipStrengthModel.calculate(typeof records==='undefined'?[]:records,typeof ownership==='undefined'?null:ownership,typeof institutional==='undefined'?null:institutional,date));
  return cache.get(date);
 }
 function weeks(){return (typeof ownership==='undefined'?[]:ownership?.weeks||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-12);}
 function scoreBar(row){
  if(!Number.isFinite(row?.score)){
   const missing=[!Number.isFinite(row?.holderDelta)&&(row?.holderIssue||'缺少相鄰週持股資料'),!Number.isFinite(row?.institutionalRatio)&&'同期法人資料'].filter(Boolean);
   return '<span class="ownership-flow-missing">綜合強度無法計算<small style="display:block">'+esc(row?.scoreReason||missing.join('、'))+'</small></span>';
  }
  return `<div class="ownership-flow-bar" role="img" aria-label="綜合籌碼強度 ${fmt(row.score)} 分"><span class="ownership-flow-track"><i style="width:${row.score}%;background:#ffe298"></i></span><strong style="color:#ffe298">${fmt(row.score)} / 100 分</strong></div>`;
 }
 function factors(row){
  const color=v=>v>0?'#ff647b':v<0?'#4dd5bd':'#dce5ef';
  return `<small class="ownership-flow-period" style="line-height:1.8">400 張以上持股 <b style="color:#ffe298">${Number.isFinite(row?.holderNow)?fmt(row.holderNow)+'%':'無本週資料'}</b> · 週增減 <b style="color:${color(row?.holderDelta)}">${Number.isFinite(row?.holderDelta)?signed(row.holderDelta):esc(row?.holderIssue||'缺少相鄰週資料，無法比較')}</b><span style="display:block">1,000 張以上持股 <b style="color:#ffe298">${Number.isFinite(row?.holder1000Now)?fmt(row.holder1000Now)+'%':'無本週資料'}</b> · 週增減 <b style="color:${color(row?.holder1000Delta)}">${Number.isFinite(row?.holder1000Delta)?signed(row.holder1000Delta):esc(row?.holderIssue||'缺少相鄰週資料，無法比較')}</b></span>法人淨買超／成交量 <b style="color:${color(row?.institutionalRatio)}">${signed(row?.institutionalRatio)}</b> · 法人合計淨買超 ${fmt(row?.institutionalNet)} 張</small>`;
 }

 function holdingBar(value,bad=false){
  if(bad||!Number.isFinite(value)||value<0||value>100)return '<span class="ownership-flow-missing">本週集保資料異常，不採用該期比例</span>';
  return `<div class="ownership-flow-bar" role="img" aria-label="持股比例 ${fmt(value)}%"><span class="ownership-flow-track"><i style="width:${value}%;background:#ffe298"></i></span><strong style="color:#ffe298">${fmt(value)}%</strong></div>`;
 }

 function draw(){
  const content=root.querySelector('#ownership-search-results');if(!content)return;
  const stock=typeof analyses==='undefined'?null:analyses.find(s=>s.code===selectedCode);
  if(!stock){content.textContent=message;return;}
  const dates=weeks(),latestDate=dates.at(-1)?.date,latest=latestDate?result(latestDate):null,current=latest?.rows.get(stock.code);
  const groups=typeof window.getHotSectorGroups==='function'?window.getHotSectorGroups():new Map(),memberships=[...groups].filter(([,codes])=>codes.has(stock.code));
  const codes=new Set(memberships.flatMap(([,set])=>[...set]));if(!codes.size)for(const s of analyses)if(s.industry&&s.industry===stock.industry)codes.add(s.code);
  const peers=analyses.filter(s=>codes.has(s.code)).sort((a,b)=>(b.score??-1)-(a.score??-1)||(a.rank??Infinity)-(b.rank??Infinity)||a.code.localeCompare(b.code));
  content.innerHTML=`<div class="ownership-search-head"><h3>${esc(stock.name)} ${esc(stock.code)}</h3><button type="button" class="ghost" id="ownership-search-detail">查看個股日線 ↗</button></div><p>收盤 ${fmt(stock.t.close)} · 均線 <strong style="color:#ffb36e">${stock.score==null?'資料待補':stock.score+' / 15'}</strong> · 市場均線排名 ${stock.rank?'#'+stock.rank:'待補'}</p><p>400 張以上持股比例 <strong style="color:#ffe298;font-size:1.2em">${fmt(dates.at(-1)?.stocks?.[stock.code]?.['400'])}%</strong> · 1,000 張以上持股 <strong style="color:#ffe298">${fmt(dates.at(-1)?.stocks?.[stock.code]?.['1000'])}%</strong> · 資料週 ${esc(latestDate||'待載入')}</p><p class="ownership-note">400 張本期持股與三大法人獨立顯示；若相鄰前週集保資料缺漏或異常，僅週增減及綜合分數無法計算，會列出缺漏日期；本期持股照常顯示。</p><h3>綜合籌碼強度</h3>${scoreBar(current)}${factors(current)}<p class="ownership-note">比較期間 ${esc(latest?.from||'—')} → ${esc(latest?.to||'—')} · 兩項完整資料比較母體 ${latest?.complete||0} 檔。${esc(latest?.reason||'')}</p><div class="ownership-search-grid"><section><h3>近期 400／1,000 張以上持股長條圖</h3>${dates.length?dates.slice().reverse().map(w=>{const data=result(w.date),r=data.rows.get(stock.code);return `<div class="ownership-flow-row"><span>${esc(w.date)}<small>400 張持股 ${fmt(w.stocks?.[stock.code]?.['400'])}%</small></span>${holdingBar(w.stocks?.[stock.code]?.['400'],!!w.invalid_stocks?.[stock.code])}<span>1,000 張以上</span>${holdingBar(w.stocks?.[stock.code]?.['1000'],!!w.invalid_stocks?.[stock.code])}${factors(r)}<div class="ownership-flow-period">綜合強度 ${scoreBar(r)}</div><small class="ownership-flow-period">${esc(data.from||'—')} → ${esc(data.to||w.date)} · 可比較 ${data.complete} 檔</small></div>`;}).join(''):'<p>集保週資料尚未載入。</p>'}</section><section><h3>相關個股均線排名與綜合籌碼</h3><p>${esc(memberships.length?memberships.map(([name])=>name).join('、'):stock.industry||'尚無族群分類')} · 依均線分數由高到低 · ${peers.length} 檔</p><div class="ownership-flow-peers">${peers.map(s=>{const r=latest?.rows.get(s.code);return `<div class="ownership-flow-row"><button type="button" data-ownership-peer="${esc(s.code)}" class="ownership-flow-stock"><strong>${esc(s.name)} ${esc(s.code)}</strong><small style="color:#ffb36e">均線 ${s.score==null?'待補':s.score+' / 15'} · ${s.rank?'市場 #'+s.rank:'未排名'}</small></button>${scoreBar(r)}${factors(r)}</div>`;}).join('')}</div></section></div><p class="ownership-note">綜合強度 0～100 分＝400 張持股週增相對分數 × 50%＋三大法人同期淨買超／成交量相對分數 × 50%。兩項在同批資料完整個股中各自轉為名次百分位，同值採平均名次；僅一檔時為 50 分。1,000 張以上另列觀察，不重複計入分數（已包含在 400 張以上）。各週母體可能不同；這是相對強度，不是實際資金流入百分比。</p><p class="ownership-note">兩項使用相鄰集保週別之間的同一交易期間。400 張週增以 % 顯示持股比例差值（30%→32% 顯示 +2%），法人力道為三大法人同期淨買超張數／同期成交量。原始數字紅增、綠減；金色持股長條顯示當週實際持股比例。缺一項則綜合分數不計算，但已有的持股與法人資料照常顯示。<a href="https://openapi.tdcc.com.tw/v1/opendata/1-5" target="_blank" rel="noopener">集保官方來源</a></p>`;
  content.querySelector('#ownership-search-detail').onclick=event=>openStockDetail(stock,event.currentTarget);
  content.querySelectorAll('[data-ownership-peer]').forEach(button=>button.onclick=()=>{selectedCode=button.dataset.ownershipPeer;draw();});
 }
 root.innerHTML='<details><summary class="ownership-search-summary">個股籌碼搜尋</summary><form id="ownership-stock-search-form" class="sector-search-form"><label for="ownership-stock-query">股票代號／名稱</label><input id="ownership-stock-query" type="search" placeholder="例如 2492、華新科"><button type="submit">確認</button><span>400 張以上＋1,000 張以上＋三大法人</span></form><div id="ownership-search-results" aria-live="polite"></div></details>';
 root.querySelector('form').onsubmit=event=>{event.preventDefault();const query=root.querySelector('input').value.trim(),stocks=typeof analyses==='undefined'?[]:analyses,matches=query?stocks.filter(s=>s.code===query||s.name===query):[];if(matches.length===1){selectedCode=matches[0].code;draw();return;}const partial=query?stocks.filter(s=>(s.code+' '+s.name).includes(query)).slice(0,20):[];selectedCode='';if(partial.length){const content=root.querySelector('#ownership-search-results');content.innerHTML='<p>請選擇個股：</p>'+partial.map(s=>`<button type="button" class="ghost" data-search-choice="${esc(s.code)}">${esc(s.code)} ${esc(s.name)}</button>`).join(' ');content.querySelectorAll('[data-search-choice]').forEach(b=>b.onclick=()=>{selectedCode=b.dataset.searchChoice;draw();});}else{message='找不到符合個股，請確認已載入正式行情及代號。';draw();}};
 const refresh=()=>{cache.clear();draw();};
 window.addEventListener('stock-data-ready',refresh);window.addEventListener('cb-chip-data-ready',refresh);
 draw();
})();
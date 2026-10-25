(() => {
 'use strict';
 const root=document.getElementById('ownership-stock-search');if(!root)return;
 let selectedCode='',message='輸入股票代號或名稱，按確認查看 400 張以上綜合籌碼。',broker=null,brokerState='分點資料載入中';
 const cache=new Map();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
 const signed=v=>Number.isFinite(v)?(v>0?'+':'')+fmt(v)+'%':'待補';
 function result(date){
  if(!cache.has(date))cache.set(date,window.ownershipStrengthModel.calculate(typeof records==='undefined'?[]:records,typeof ownership==='undefined'?null:ownership,typeof institutional==='undefined'?null:institutional,broker,date));
  return cache.get(date);
 }
 function weeks(){return (typeof ownership==='undefined'?[]:ownership?.weeks||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-12);}
 function scoreBar(row){
  if(!Number.isFinite(row?.score)){
   const missing=[!Number.isFinite(row?.holderDelta)&&'400 張相鄰週資料',!Number.isFinite(row?.institutionalRatio)&&'同期法人資料',!Number.isFinite(row?.brokerRatio)&&'同期分點資料'].filter(Boolean);
   return '<span class="ownership-flow-missing">綜合強度待補<small style="display:block">'+esc(missing.join('、'))+'</small></span>';
  }
  return `<div class="ownership-flow-bar" role="img" aria-label="綜合籌碼強度 ${fmt(row.score)} 分"><span class="ownership-flow-track"><i style="width:${row.score}%;background:#ffe298"></i></span><strong style="color:#ffe298">${fmt(row.score)} / 100 分</strong></div>`;
 }
 function factors(row){
  const color=v=>v>0?'#ff647b':v<0?'#4dd5bd':'#dce5ef';
  return `<small class="ownership-flow-period" style="line-height:1.8">400 張持股增減 <b style="color:${color(row?.holderDelta)}">${signed(row?.holderDelta)}</b> · 法人淨買超／成交量 <b style="color:${color(row?.institutionalRatio)}">${signed(row?.institutionalRatio)}</b> · 分點集中度 <b style="color:${color(row?.brokerRatio)}">${signed(row?.brokerRatio)}</b></small>`;
 }
 function draw(){
  const content=root.querySelector('#ownership-search-results');if(!content)return;
  const stock=typeof analyses==='undefined'?null:analyses.find(s=>s.code===selectedCode);
  if(!stock){content.textContent=message;return;}
  const dates=weeks(),latestDate=dates.at(-1)?.date,latest=latestDate?result(latestDate):null,current=latest?.rows.get(stock.code);
  const groups=typeof window.getHotSectorGroups==='function'?window.getHotSectorGroups():new Map(),memberships=[...groups].filter(([,codes])=>codes.has(stock.code));
  const codes=new Set(memberships.flatMap(([,set])=>[...set]));if(!codes.size)for(const s of analyses)if(s.industry&&s.industry===stock.industry)codes.add(s.code);
  const peers=analyses.filter(s=>codes.has(s.code)).sort((a,b)=>(b.score??-1)-(a.score??-1)||(a.rank??Infinity)-(b.rank??Infinity)||a.code.localeCompare(b.code));
  content.innerHTML=`<div class="ownership-search-head"><h3>${esc(stock.name)} ${esc(stock.code)}</h3><button type="button" class="ghost" id="ownership-search-detail">查看個股日線 ↗</button></div><p>收盤 ${fmt(stock.t.close)} · 均線 <strong style="color:#ffb36e">${stock.score==null?'資料待補':stock.score+' / 15'}</strong> · 市場均線排名 ${stock.rank?'#'+stock.rank:'待補'}</p><p>400 張以上持股比例 ${fmt(current?.holderNow)}% · 資料週 ${esc(latestDate||'待載入')}</p><h3>綜合籌碼強度</h3>${scoreBar(current)}${factors(current)}<p class="ownership-note">比較期間 ${esc(latest?.from||'—')} → ${esc(latest?.to||'—')} · 三項資料齊全可比較 ${latest?.complete||0} 檔。${esc(brokerState||latest?.reason||'')}</p><div class="ownership-search-grid"><section><h3>近期綜合籌碼強度長條圖</h3>${dates.length?dates.slice().reverse().map(w=>{const data=result(w.date),r=data.rows.get(stock.code);return `<div class="ownership-flow-row"><span>${esc(w.date)}<small>400 張持股 ${fmt(w.stocks?.[stock.code]?.['400'])}%</small></span>${scoreBar(r)}${factors(r)}<small class="ownership-flow-period">${esc(data.from||'—')} → ${esc(data.to||w.date)} · 可比較 ${data.complete} 檔</small></div>`;}).join(''):'<p>集保週資料尚未載入。</p>'}</section><section><h3>相關個股均線排名與綜合籌碼</h3><p>${esc(memberships.length?memberships.map(([name])=>name).join('、'):stock.industry||'尚無族群分類')} · 依均線分數由高到低 · ${peers.length} 檔</p><div class="ownership-flow-peers">${peers.map(s=>{const r=latest?.rows.get(s.code);return `<div class="ownership-flow-row"><button type="button" data-ownership-peer="${esc(s.code)}" class="ownership-flow-stock"><strong>${esc(s.name)} ${esc(s.code)}</strong><small style="color:#ffb36e">均線 ${s.score==null?'待補':s.score+' / 15'} · ${s.rank?'市場 #'+s.rank:'未排名'}</small></button>${scoreBar(r)}${factors(r)}</div>`;}).join('')}</div></section></div><p class="ownership-note">綜合強度 0～100 分＝同批完整資料個股中，400 張持股增幅名次百分位 × 40%＋三大法人淨買超／同期成交量名次百分位 × 30%＋分點集中度名次百分位 × 30%。同值取平均名次；只有一檔時為 50 分。各週比較母體可能不同，分數是相對強度，不是實際持股增加%或資金流入%。</p><p class="ownership-note">三項使用相鄰兩週集保日期間的同一交易期間。400 張增減以 % 顯示持股比例差值（例如 30%→32% 顯示 +2%）；法人為三大法人合計淨買超張數／同期成交張數；大戶分點以公開前 15 大買超與賣超分點淨額差／同期成交量作為集中度代理，不能識別實際大戶身份。原始數值紅增、綠減；三項不直接相加，避免分母不同與交易重疊。缺任何一項就留待補，不用其他日期代替。搜尋可查全部個股，與排行榜排除名單分開。</p>`;
  content.querySelector('#ownership-search-detail').onclick=event=>openStockDetail(stock,event.currentTarget);
  content.querySelectorAll('[data-ownership-peer]').forEach(button=>button.onclick=()=>{selectedCode=button.dataset.ownershipPeer;draw();});
 }
 root.innerHTML='<details><summary class="ownership-search-summary">個股籌碼搜尋</summary><form id="ownership-stock-search-form" class="sector-search-form"><label for="ownership-stock-query">股票代號／名稱</label><input id="ownership-stock-query" type="search" placeholder="例如 2492、華新科"><button type="submit">確認</button><span>400 張以上＋三大法人＋大戶分點</span></form><div id="ownership-search-results" aria-live="polite"></div></details>';
 root.querySelector('form').onsubmit=event=>{event.preventDefault();const query=root.querySelector('input').value.trim(),stocks=typeof analyses==='undefined'?[]:analyses,matches=query?stocks.filter(s=>s.code===query||s.name===query):[];if(matches.length===1){selectedCode=matches[0].code;draw();return;}const partial=query?stocks.filter(s=>(s.code+' '+s.name).includes(query)).slice(0,20):[];selectedCode='';if(partial.length){const content=root.querySelector('#ownership-search-results');content.innerHTML='<p>請選擇個股：</p>'+partial.map(s=>`<button type="button" class="ghost" data-search-choice="${esc(s.code)}">${esc(s.code)} ${esc(s.name)}</button>`).join(' ');content.querySelectorAll('[data-search-choice]').forEach(b=>b.onclick=()=>{selectedCode=b.dataset.searchChoice;draw();});}else{message='找不到符合個股，請確認已載入正式行情及代號。';draw();}};
 const refresh=()=>{cache.clear();draw();};
 window.addEventListener('stock-data-ready',refresh);window.addEventListener('cb-chip-data-ready',refresh);
 fetch('broker-data.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('分點資料讀取失敗');return r.json();}).then(data=>{if(data.version!==1||!Array.isArray(data.periods))throw Error('分點資料格式錯誤');broker=data;brokerState='';refresh();}).catch(error=>{brokerState=error.message+'，請稍後重新整理';refresh();});
 draw();
})();
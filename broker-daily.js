(() => {
 'use strict';
 let snapshot=null,error='',selectedCode='';
 const scoreCache=new Map();
 function combined(date){if(!scoreCache.has(date))scoreCache.set(date,window.dailyChipStrength.calculate(typeof records==='undefined'?[]:records,typeof ownership==='undefined'?null:ownership,typeof institutional==='undefined'?null:institutional,snapshot,date));return scoreCache.get(date);}
 function scoreChart(rows){return '<details open><summary class="ownership-search-summary">每日綜合籌碼強度</summary>'+rows.slice().reverse().map(({date})=>{const data=combined(date),row=data.rows.get(selectedCode),ready=Number.isFinite(row?.score);return `<div class="ownership-flow-row"><span>${esc(date)}</span>${ready?`<div class="ownership-flow-bar" role="img" aria-label="${esc(date)} 綜合強度 ${fmt(row.score)} 分"><span class="ownership-flow-track"><i style="width:${row.score}%;background:#ffe298"></i></span><strong style="color:#ffe298">${fmt(row.score)} / 100 分</strong></div>`:`<span class="ownership-flow-missing">無法計算：${esc(row?.missing.join('、')||'資料不足')}</span>`}<small class="ownership-flow-period">400 張週增 ${Number.isFinite(row?.holderDelta)?signed(row.holderDelta)+'%':'無法比較'}（${esc(data.priorWeek||'—')} → ${esc(data.week||'—')}） · 當日分點 ${Number.isFinite(row?.brokerRatio)?signed(row.brokerRatio)+'%':'未齊'} · 當日法人力道 ${Number.isFinite(row?.institutionalRatio)?signed(row.institutionalRatio)+'%':'未齊'} · 比較母體 ${data.complete} 檔</small></div>`;}).join('')+'<p class="ownership-note">0～100 分＝400 張持股週增相對排名 × 40%＋當日分點集中度相對排名 × 30%＋當日三大法人淨買超／成交量相對排名 × 30%。三項皆在同一批完整資料個股中轉為名次百分位，同值取平均名次，只有一檔時為 50 分。法人及分點使用同一交易日，集保使用該日期或之前最新兩個相鄰週別；週更新前沿用。缺一項就不計完整分數，不改用其他日期。分數為相對強度，不是實際資金流入%或勝率。各日母體可能改變；歷史圖依資料日期配對，未留存集保發布時間，因此不作當日可得資料回測。</p></details>';}
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
 const signed=v=>(v>0?'+':'')+fmt(v);
 function validated(row,date){
  if(!row||row.date!==date||row.unit!=='lots'||row.top_n!==15||![row.buy_lots,row.sell_lots,row.net_lots,row.volume_lots].every(Number.isFinite)||row.buy_lots<0||row.sell_lots<0||row.volume_lots<=0||Math.abs(row.buy_lots-row.sell_lots-row.net_lots)>.01)return null;
  return {...row,ratio:row.net_lots/row.volume_lots*100};
 }
 function missing(session,code){
  const issue=session?.errors?.[code]||'';
  if(!session)return '此交易日尚未收錄';
  if(/Incomplete|Missing|Duplicate|arithmetic|reconcile|ordered/i.test(issue))return '報表不完整或未通過核對';
  if(/period|Stale/i.test(issue))return '來源未提供符合此日期的報表';
  return issue?'來源暫時讀取失敗':'此股當日報表未收錄';
 }

 function renderPeerScores(date){
  document.querySelectorAll('[data-daily-peer-score]').forEach(target=>{
   if(!snapshot){target.innerHTML='<span class="ownership-flow-missing">'+esc(error||'每日綜合資料載入中…')+'</span>';return;}
   if(!date){target.innerHTML='<span class="ownership-flow-missing">尚無交易日資料</span>';return;}
   const data=combined(date),row=data.rows.get(target.dataset.dailyPeerScore),ready=Number.isFinite(row?.score);
   target.innerHTML=(ready?`<div class="ownership-flow-bar" role="img" aria-label="${esc(date)} 每日綜合強度 ${fmt(row.score)} 分"><span class="ownership-flow-track"><i style="width:${row.score}%;background:#ffe298"></i></span><strong style="color:#ffe298">${fmt(row.score)} / 100 分</strong></div>`:`<span class="ownership-flow-missing">無法計算：${esc(row?.missing.join('、')||'資料不足')}</span>`)+`<small style="display:block;line-height:1.8;margin-top:5px">${esc(date)} · 集保 ${esc(data.priorWeek||'—')} → ${esc(data.week||'—')}<br>400 張週增 ${Number.isFinite(row?.holderDelta)?signed(row.holderDelta)+'%':'無法比較'} · 當日分點 ${Number.isFinite(row?.brokerRatio)?signed(row.brokerRatio)+'%':'未齊'} · 當日法人力道 ${Number.isFinite(row?.institutionalRatio)?signed(row.institutionalRatio)+'%':'未齊'}</small>`;
  });
 }

 function render(code){
  if(code)selectedCode=code;
  const root=document.getElementById('ownership-daily-concentration');if(!root||!selectedCode)return;
  if(!snapshot){renderPeerScores();root.innerHTML='<h3>每日前 15 大分點集中度</h3><p>'+esc(error||'每日分點資料載入中…')+'</p>';return;}
  const sessions=new Map(snapshot.sessions.map(s=>[s.date,s])),first=snapshot.sessions[0]?.date;
  const dates=[...new Set((typeof records==='undefined'?[]:records).flatMap(s=>s.bars.map(b=>b.date)))].sort().filter(d=>!first||d>=first).slice(-20);
  const rows=dates.map(date=>({date,session:sessions.get(date),row:validated(sessions.get(date)?.stocks?.[selectedCode],date)}));
  const scale=Math.max(1,...rows.map(r=>Math.abs(r.row?.ratio||0))),latest=rows.at(-1);
  renderPeerScores(latest?.date);
  root.innerHTML=scoreChart(rows)+`<details><summary class="ownership-search-summary">每日前 15 大分點集中度</summary><p>最新交易日 ${esc(latest?.date||'—')} · ${latest?.row?'集中度 <strong style="color:'+(latest.row.ratio>=0?'#ff647b':'#4dd5bd')+'">'+signed(latest.row.ratio)+'%</strong> · 集中淨額 '+signed(latest.row.net_lots)+' 張':esc(missing(latest?.session,selectedCode))}</p><div>${rows.slice().reverse().map(({date,session,row})=>`<div class="ownership-flow-row"><span>${esc(date)}</span>${row?`<div class="ownership-flow-bar" role="img" aria-label="${esc(date)} 集中度 ${signed(row.ratio)}%"><span class="ownership-flow-track" style="position:relative;height:12px"><i style="position:absolute;left:${row.ratio>=0?50:50-Math.abs(row.ratio)/scale*50}%;width:${Math.abs(row.ratio)/scale*50}%;background:${row.ratio>=0?'#ff647b':'#4dd5bd'}"></i><span style="position:absolute;left:50%;height:100%;border-left:1px solid #dce5ef"></span></span><strong style="color:${row.ratio>0?'#ff647b':row.ratio<0?'#4dd5bd':'#dce5ef'}">${signed(row.ratio)}%</strong></div><small class="ownership-flow-period">買超合計 ${fmt(row.buy_lots)} 張 · 賣超合計 ${fmt(row.sell_lots)} 張 · 集中淨額 ${signed(row.net_lots)} 張 · 當日量 ${fmt(row.volume_lots)} 張 · <a href="${esc(row.source)}" target="_blank" rel="noopener">單日報表</a></small>`:`<span class="ownership-flow-missing">${esc(missing(session,selectedCode))}</span>`}</div>`).join('')||'<p>尚無交易日資料。</p>'}</div><p class="ownership-note">每日集中度＝（當日前 15 大買超分點淨買超合計－前 15 大賣超分點淨賣超合計）÷ 當日成交量 × 100%。漲紅、跌綠，長條中心為 0；前 15 大依淨買賣超排序，並非成交量前 15 名。分點代表券商通路，無法識別大戶身份。單日資料與集保週資料分開，不納入原有週區間分數；另與當日法人及最新週集保配成上方每日綜合強度。從 ${esc(first||'—')} 起逐日累積，最多顯示最近 20 個交易日；缺漏不當成 0%，不以週報替代。</p></details>`;
 }
 window.renderOwnershipDailyConcentration=render;
 fetch('broker-daily-data.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('每日分點資料讀取失敗，請稍後重新整理');return r.json();}).then(data=>{if(data.version!==1||!Array.isArray(data.sessions))throw Error('每日分點資料格式錯誤');data.sessions.sort((a,b)=>a.date.localeCompare(b.date));snapshot=data;scoreCache.clear();render();}).catch(e=>{error=e.message;render();});
 const refresh=()=>{scoreCache.clear();render();};
 window.addEventListener('stock-data-ready',refresh);
 window.addEventListener('cb-chip-data-ready',refresh);
})();
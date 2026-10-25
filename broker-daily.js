(() => {
 'use strict';
 let snapshot=null,error='',selectedCode='';
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
 function render(code){
  if(code)selectedCode=code;
  const root=document.getElementById('ownership-daily-concentration');if(!root||!selectedCode)return;
  if(!snapshot){root.innerHTML='<h3>每日前 15 大分點集中度</h3><p>'+esc(error||'每日分點資料載入中…')+'</p>';return;}
  const sessions=new Map(snapshot.sessions.map(s=>[s.date,s])),first=snapshot.sessions[0]?.date;
  const dates=[...new Set((typeof records==='undefined'?[]:records).flatMap(s=>s.bars.map(b=>b.date)))].sort().filter(d=>!first||d>=first).slice(-20);
  const rows=dates.map(date=>({date,session:sessions.get(date),row:validated(sessions.get(date)?.stocks?.[selectedCode],date)}));
  const scale=Math.max(1,...rows.map(r=>Math.abs(r.row?.ratio||0))),latest=rows.at(-1);
  root.innerHTML=`<details open><summary class="ownership-search-summary">每日前 15 大分點集中度</summary><p>最新交易日 ${esc(latest?.date||'—')} · ${latest?.row?'集中度 <strong style="color:'+(latest.row.ratio>=0?'#ff647b':'#4dd5bd')+'">'+signed(latest.row.ratio)+'%</strong> · 集中淨額 '+signed(latest.row.net_lots)+' 張':esc(missing(latest?.session,selectedCode))}</p><div>${rows.slice().reverse().map(({date,session,row})=>`<div class="ownership-flow-row"><span>${esc(date)}</span>${row?`<div class="ownership-flow-bar" role="img" aria-label="${esc(date)} 集中度 ${signed(row.ratio)}%"><span class="ownership-flow-track" style="position:relative;height:12px"><i style="position:absolute;left:${row.ratio>=0?50:50-Math.abs(row.ratio)/scale*50}%;width:${Math.abs(row.ratio)/scale*50}%;background:${row.ratio>=0?'#ff647b':'#4dd5bd'}"></i><span style="position:absolute;left:50%;height:100%;border-left:1px solid #dce5ef"></span></span><strong style="color:${row.ratio>0?'#ff647b':row.ratio<0?'#4dd5bd':'#dce5ef'}">${signed(row.ratio)}%</strong></div><small class="ownership-flow-period">買超合計 ${fmt(row.buy_lots)} 張 · 賣超合計 ${fmt(row.sell_lots)} 張 · 集中淨額 ${signed(row.net_lots)} 張 · 當日量 ${fmt(row.volume_lots)} 張 · <a href="${esc(row.source)}" target="_blank" rel="noopener">單日報表</a></small>`:`<span class="ownership-flow-missing">${esc(missing(session,selectedCode))}</span>`}</div>`).join('')||'<p>尚無交易日資料。</p>'}</div><p class="ownership-note">每日集中度＝（當日前 15 大買超分點淨買超合計－前 15 大賣超分點淨賣超合計）÷ 當日成交量 × 100%。漲紅、跌綠，長條中心為 0；前 15 大依淨買賣超排序，並非成交量前 15 名。分點代表券商通路，無法識別大戶身份。單日資料與集保週資料分開，亦不納入上方綜合分數。從 ${esc(first||'—')} 起逐日累積，最多顯示最近 20 個交易日；缺漏不當成 0%，不以週報替代。</p></details>`;
 }
 window.renderOwnershipDailyConcentration=render;
 fetch('broker-daily-data.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('每日分點資料讀取失敗，請稍後重新整理');return r.json();}).then(data=>{if(data.version!==1||!Array.isArray(data.sessions))throw Error('每日分點資料格式錯誤');data.sessions.sort((a,b)=>a.date.localeCompare(b.date));snapshot=data;render();}).catch(e=>{error=e.message;render();});
 window.addEventListener('stock-data-ready',()=>render());
})();
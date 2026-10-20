(() => {
  'use strict';
  if(typeof renderOwnership!=='function')return;
  let snapshot=null,error='';
  const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
  function render(){
    if(ownershipMode!=='chipburst')return;
    const parent=document.getElementById('chipburst-info');if(!parent)return;
    let root=parent.querySelector('#overnight-entry');
    if(!root){root=document.createElement('section');root.id='overnight-entry';root.className='overnight-panel';parent.appendChild(root);}
    root.innerHTML='<h3>隔日沖分點進場｜觀察</h3>';
    if(!snapshot){root.innerHTML+=`<p role="status">${e(error||'正在載入單日分點資料…')}</p>`;return;}
    const latest=records.map(s=>s.bars.at(-1)?.date||'').sort().at(-1),today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());
    const usable=snapshot.date===latest;
    const rows=usable?snapshot.rows.filter(r=>r.date===snapshot.date&&r.volume>500&&r.net_lots>0&&r.branches?.length):[];
    root.innerHTML+=`<p class="overnight-date">分點資料日 ${e(snapshot.date)} ${snapshot.date===today?'· 今日盤後':'· 非今日資料'}</p><p>單日觀察範圍：當日成交量大於 500 張個股 ${snapshot.requested} 檔，成功取得 ${snapshot.available} 檔，缺漏 ${snapshot.requested-snapshot.available} 檔。每檔僅涵蓋買超前 15 大分點；未列入不代表沒有買進。</p><p class="chipburst-detail-note">觀察分點淨買超不代表已確認隔日沖；券商分點包含不同客戶，需下一交易日進出資料才能追蹤。買超合計只加總當日淨買超的觀察分點。</p><details><summary>查看觀察分點與來源（${snapshot.watch.length} 個）</summary><p>${(snapshot.core_watch||snapshot.watch).map(e).join('、')}</p>${snapshot.custom_watch?.length?`<p>自訂觀察：${snapshot.custom_watch.map(e).join('、')}</p>`:''}<p>外資通路（美林、摩根大通、美商高盛）包含多種客戶與策略，列入觀察不代表隔日沖。</p><p>歷史公開教材名單，非官方認定，交易風格可能改變；不將整家券商或所有外資通路視為隔日沖。</p>${snapshot.sources.map(s=>`<a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title)} ↗</a>`).join(' · ')}</details>${!usable?`<p class="chipburst-message">最新股價日 ${e(latest)} 與分點資料日不同，暫不顯示進場名單，避免將舊買超當成今日訊號。</p>`:rows.length?`<p>符合 ${snapshot.matched??rows.length} 檔，顯示前 30 名，依買超占當日成交量比例排序。</p><div class="chipburst-table-wrap"><table class="chipburst-table"><thead><tr><th>排名</th><th>個股／收盤</th><th>觀察分點買超</th><th>占當日成交量</th><th>分點明細（買／賣／淨買超，張）</th></tr></thead><tbody>${rows.slice(0,30).map((r,i)=>`<tr><td>${i+1}</td><td><button type="button" data-overnight-code="${e(r.code)}"><strong>${e(r.name)} ${e(r.code)}</strong>收盤 ${n(r.close)}<small>當日量 ${n(r.volume)} 張</small></button></td><td class="chipburst-buy">+${n(r.net_lots)} 張</td><td>${n(r.ratio)}%</td><td>${r.branches.map(b=>`<small>${e(b.name)}：${n(b.buy_lots)}／${n(b.sell_lots)}／+${n(b.net_lots)}</small>`).join('')}<a href="${e(r.source)}" target="_blank" rel="noopener noreferrer">查核單日報表 ↗</a></td></tr>`).join('')}</tbody></table></div>`:'<p>已成功取得的單日報表中，目前沒有符合的觀察分點買超個股。</p>'}`;
    root.querySelectorAll('[data-overnight-code]').forEach(b=>b.addEventListener('click',()=>{const stock=analyses.find(s=>s.code===b.dataset.overnightCode);if(stock)openStockDetail(stock,b);}));
  }
  const original=renderOwnership;
  renderOwnership=function(...args){original.apply(this,args);render();};
  const parent=document.getElementById('chipburst-info');
  if(parent)new MutationObserver(()=>{if(ownershipMode==='chipburst'&&!parent.querySelector('#overnight-entry'))render();}).observe(parent,{childList:true});
  window.addEventListener('cb-chip-data-ready',render);
  fetch('overnight-data.json',{cache:'no-cache'}).then(async r=>{if(!r.ok)throw Error('單日分點資料尚未發布。');const data=await r.json();if(data.version!==1||data.unit!=='lots'||!Array.isArray(data.rows))throw Error('單日分點資料格式不符。');snapshot=data;render();}).catch(err=>{error=err.message;render();});
})();

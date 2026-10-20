(() => {
  'use strict';
  if(typeof renderOwnership!=='function')return;
  let snapshot=null,error='',screenMode='reference';
  const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
  function render(){
    const root=document.getElementById('overnight-entry');if(!root)return;
    root.innerHTML='';
    if(!snapshot){root.innerHTML+=`<p role="status">${e(error||'正在載入單日分點資料…')}</p>`;return;}
    const latest=records.map(s=>s.bars.at(-1)?.date||'').sort().at(-1),today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());
    const usable=snapshot.date===latest;
    const rows=usable?snapshot.rows.filter(r=>r.date===snapshot.date&&r.close>=20&&r.volume>500&&r.net_lots>0&&r.branches?.length&&(screenMode==='broad'||(r.volume>1000&&r.net_lots>=100))):[];
    root.innerHTML+=`<div class="sector-search-form"><label for="overnight-screen-mode">篩選模式</label><select id="overnight-screen-mode"><option value="reference" ${screenMode==='reference'?'selected':''}>截圖比對：量＞1,000 張、分點買超≥100 張</option><option value="broad" ${screenMode==='broad'?'selected':''}>寬鬆：量＞500 張、分點買超＞0 張</option></select></div><p class="chipburst-detail-note">共同條件：收盤至少 20 元、估算收盤漲停。漲停價依前收盤 × 1.1 與台股跳動單位取整；除權息、減資、無漲跌幅限制等特殊情況需另行核對。截圖比對門檻是依單日樣本整理的網站自訂規則，未確認為籌碼 K 線內部公式。</p><p class="overnight-date">分點資料日 ${e(snapshot.date)} ${snapshot.date===today?'· 今日盤後':'· 非今日資料'}</p><p>單日觀察範圍：當日成交量大於 500 張個股 ${snapshot.requested} 檔，成功取得 ${snapshot.available} 檔，缺漏 ${snapshot.requested-snapshot.available} 檔。每檔僅涵蓋買超前 15 大分點；未列入不代表沒有買進。</p><p class="chipburst-detail-note">觀察分點淨買超不代表已確認隔日沖；券商分點包含不同客戶，需下一交易日進出資料才能追蹤。買超合計只加總當日淨買超的觀察分點。占比＝這些分點淨買超張數合計 ÷ 個股當日成交量 × 100%，不是已確認隔日沖交易占比。</p><details><summary>查看觀察分點與來源（${snapshot.watch.length} 個）</summary><p>${(snapshot.core_watch||snapshot.watch).map(e).join('、')}</p>${snapshot.public_watch?.length?`<p>公開文章具名觀察：${snapshot.public_watch.map(e).join('、')}</p>`:''}${snapshot.image_watch?.length?`<p>使用者圖片指定：${snapshot.image_watch.map(e).join('、')}</p><p>僅依券商報表完整名稱精確比對，總公司通路不會延伸匹配旗下全部分點。圖片的元富缺少完整分點名稱，沿用已指定的元富－松德；未套用圖中出貨機率或買超被圈的判斷。</p>`:''}${snapshot.custom_watch?.length?`<p>自訂觀察：${snapshot.custom_watch.map(e).join('、')}</p>`:''}<p>外資通路（美林、摩根大通、美商高盛）包含多種客戶與策略，列入觀察不代表隔日沖。</p>${snapshot.unseen_watch?.length?`<p>本批前 15 大報表未出現：${snapshot.unseen_watch.map(e).join('、')}；不代表零交易或分點不存在。</p>`:''}<p></p><p>公開可查名單與自訂觀察合併去重；含歷史文章、用戶筆記與第三方統計，可靠程度不同，不等同籌碼 K 線完整內建名單或官方認定。交易風格可能改變；未把泛稱的地區幫派或整家券商直接展開成所有分點。</p>${snapshot.sources.map(s=>`<a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title)} ↗</a>${s.branches?`<small>（${s.branches.map(e).join('、')}）</small>`:''}`).join(' · ')}</details>${!usable?`<p class="chipburst-message">最新股價日 ${e(latest)} 與分點資料日不同，暫不顯示進場名單，避免將舊買超當成今日訊號。</p>`:rows.length?`<p>符合 ${rows.length} 檔，依股票代號排列；顯示分點買超占當日成交量比例。</p><div class="chipburst-table-wrap"><table class="chipburst-table"><thead><tr><th>排名</th><th>個股／收盤</th><th>均線分數／排名</th><th>觀察分點買超</th><th>隔日沖觀察分點占比</th><th>分點明細（買／賣／淨買超，張）</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td><button type="button" data-overnight-code="${e(r.code)}"><strong>${e(r.name)} ${e(r.code)}</strong>收盤 ${n(r.close)}<small>當日量 ${n(r.volume)} 張</small></button></td><td class="overnight-ma">${(()=>{const a=analyses.find(s=>s.code===r.code);return a?`<strong>均線 ${a.score==null?'待補資料':a.score+' / 15'}</strong><small>${a.rank?'市場均線排名 #'+a.rank:'未排名'}</small>`:'待補資料';})()}</td><td class="chipburst-buy">+${n(r.net_lots)} 張</td><td><strong class="overnight-ratio">${n(r.ratio)}%</strong></td><td>${r.branches.map(b=>`<small>${e(b.name)}：${n(b.buy_lots)}／${n(b.sell_lots)}／+${n(b.net_lots)}</small>`).join('')}<a href="${e(r.source)}" target="_blank" rel="noopener noreferrer">查核單日報表 ↗</a></td></tr>`).join('')}</tbody></table></div>`:'<p>已成功取得的單日報表中，目前沒有符合的觀察分點買超個股。</p>'}`;
    root.querySelector('#overnight-screen-mode').addEventListener('change',event=>{screenMode=event.target.value;render();});
    root.querySelectorAll('[data-overnight-code]').forEach(b=>b.addEventListener('click',()=>{const stock=analyses.find(s=>s.code===b.dataset.overnightCode);if(stock)openStockDetail(stock,b);}));
  }
  const original=renderOwnership;
  renderOwnership=function(...args){original.apply(this,args);render();};
  const toggle=document.getElementById('overnight-toggle');
  toggle?.addEventListener('click',()=>{
    const content=document.getElementById('overnight-entry');
    content.hidden=!content.hidden;
    toggle.setAttribute('aria-expanded',String(!content.hidden));
    toggle.textContent=content.hidden?'展開分點名單 ▾':'收合分點名單 ▴';
    if(!content.hidden)render();
  });
  window.addEventListener('cb-chip-data-ready',render);
  fetch('overnight-data.json',{cache:'no-cache'}).then(async r=>{if(!r.ok)throw Error('單日分點資料尚未發布。');const data=await r.json();if(data.version!==1||data.unit!=='lots'||!Array.isArray(data.rows))throw Error('單日分點資料格式不符。');snapshot=data;render();}).catch(err=>{error=err.message;render();});
})();

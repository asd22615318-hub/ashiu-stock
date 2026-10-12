/* Convertible-bond screening rules supplied by the site owner. */
(() => {
  const root = document.getElementById('convertible');
  if (!root) return;
  function cbVolumeSignals(bars){
    if(!Array.isArray(bars)||bars.length<21)return {abnormal:null,continuous:null,ratio20:null,ratio3:null};
    const volumes=bars.map(bar=>Number(bar.volume));
    if(volumes.some(volume=>!Number.isFinite(volume)||volume<0))return {abnormal:null,continuous:null,ratio20:null,ratio3:null};
    const recent=volumes.slice(-3).reduce((sum,value)=>sum+value,0);
    const prior=volumes.slice(-6,-3).reduce((sum,value)=>sum+value,0);
    const average20=volumes.slice(-21,-1).reduce((sum,value)=>sum+value,0)/20;
    const ratio20=average20>0?volumes.at(-1)/average20:null;
    const ratio3=prior>0?recent/prior:null;
    return {abnormal:ratio20===null?null:ratio20>=3,continuous:ratio3===null?null:ratio3>=2,ratio20,ratio3};
  }
  window.cbVolumeSignals=cbVolumeSignals;
  root.innerHTML = `
    <div class="sector-heading"><h1>可轉債雷達</h1><p>CB 領先正股 · 觀察可轉債量價與正股的連動</p></div>
    <div class="cb-data-status" id="cb-data-status" role="status"><strong>正在載入可轉債資料…</strong><span>確認每日價量與集保月報中。</span></div>
    <section class="cb-panel cb-strategy-panel"><div class="cb-panel-heading"><div><span class="cb-kicker">CB 領先正股 · 波段觀察</span><h2>三個領先訊號</h2></div></div><div class="cb-strategy-steps"><div><strong>① CB 放量</strong><span>當日量 ≥ 前 20 日均量 3 倍，或近 3 日總量 ≥ 前 3 日總量 2 倍。</span></div><div><strong>② CB 價格上行</strong><span>比較已取得的每日收市價；尚無日價量時標示待資料，不推測訊號。</span></div><div><strong>③ 對照正股</strong><span>查看正股與目前轉換價距離、MA20／MA60 和近 20 日高點，再判斷是否仍在整理。</span></div></div><p class="cb-data-note">這是觀察順序；個股未同時符合時仍可搜尋查看，不代表進場訊號。</p></section>
    <section class="cb-panel cb-watch-panel"><div class="cb-panel-heading"><div><span class="cb-kicker">波段策略 · 正股觀察</span><h2>CB 對照正股蓄勢名單</h2></div><small id="cb-watch-count">資料載入中</small></div><p class="cb-data-note">CB 異常放量＝當日成交單位 ÷ 前 20 個交易日均量 ≥ 3；連續放量＝近 3 日總量 ÷ 再前 3 日總量 ≥ 2。等價與議價成交單位加總；無成交日計 0，均量不含當日。價差篩選只採用集保公布的目前轉換價格；沒有目前價格的可轉債不列入。</p><div class="cb-watch-controls"><label>顯示 <select id="cb-watch-filter"><option value="gap0to10">正股低於轉換價 0～10%</option><option value="gap11to20">正股低於轉換價 11～20%</option><option value="gap21to50">正股低於轉換價 21～50%</option><option value="gapAbove0to5">正股高於轉換價 0～5%</option><option value="watch">正股蓄勢</option><option value="all">全部有 CB 正股</option></select></label><form id="cb-search-form" class="cb-search-form"><label for="cb-watch-search">搜尋</label><input id="cb-watch-search" type="search" placeholder="代號、名稱或 CB 代號"><button type="submit" id="cb-search-confirm">確認</button></form></div><div id="cb-watch-list" class="cb-watch-list" aria-live="polite"><p>正在對照可轉債與正股行情…</p></div></section>
    <dialog id="cb-search-dialog" class="cb-search-dialog" aria-labelledby="cb-search-title"><div class="cb-search-dialog-head"><h2 id="cb-search-title">個股與可轉債資訊</h2><button id="cb-search-close" type="button">× 返回</button></div><div id="cb-search-results" class="cb-watch-list"></div></dialog><section class="cb-panel" id="cb-data-panel" hidden><div class="cb-panel-heading"><div><span class="cb-kicker">官方資料</span><h2>可轉債保管月報</h2></div><small id="cb-data-period"></small></div><p class="cb-data-note">按本月底集保保管張數排序；月資料不代表今日成交量。發行張數為發行規模，並非剩餘流通張數。</p><label class="cb-search-label">搜尋代號或名稱 <input id="cb-data-search" type="search" placeholder="輸入可轉債或正股代號"></label><div class="cb-table-wrap"><table class="cb-table"><thead><tr><th>可轉債／正股</th><th>本月底保管</th><th>較前月</th><th>發行張數</th><th>集保戶數</th></tr></thead><tbody id="cb-data-rows"></tbody></table></div><p class="cb-data-note">資料來源：<a href="https://data.gov.tw/dataset/11462" target="_blank" rel="noopener">集保結算所可轉換公司債月分析表</a>。缺值以「—」表示。</p></section><button id="cb-watch-return" class="cb-watch-return" type="button" hidden>↑ 返回</button>`;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fmt = value => value == null ? '—' : Number(value).toLocaleString('zh-TW');
  let allBonds = [];
  let cbChipSnapshot = null;
  const today = () => { const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part => [part.type,part.value])); return `${parts.year}-${parts.month}-${parts.day}`; };
  window.convertibleDataStatus = 'loading';
  window.activeConvertibleBonds = code => allBonds.filter(bond => bond.underlying_code === String(code) && bond.maturity_date && bond.maturity_date >= today() && bond.conversion_price_kind === 'current_official' && Number(bond.conversion_price) > 0 && (bond.outstanding_amount == null || Number(bond.outstanding_amount) > 0));
  const status = root.querySelector('#cb-data-status');
  const panel = root.querySelector('#cb-data-panel');
  const watchList = root.querySelector('#cb-watch-list');
  const watchCount = root.querySelector('#cb-watch-count');
  const watchFilter = root.querySelector('#cb-watch-filter');
  const watchSearch = root.querySelector('#cb-watch-search');
  const searchDialog = root.querySelector('#cb-search-dialog');
  const searchResults = root.querySelector('#cb-search-results');
  for(const [selector,id,expanded] of [['.cb-strategy-panel','cb-strategy-content',false],['.cb-watch-panel','cb-watch-content',true],['#cb-data-panel','cb-data-content',false]]){
    const section=root.querySelector(selector),heading=section?.querySelector('.cb-panel-heading');
    if(!heading)continue;
    const content=document.createElement('div');content.id=id;content.hidden=!expanded;
    while(heading.nextSibling)content.appendChild(heading.nextSibling);
    section.appendChild(content);
    const toggle=document.createElement('button');toggle.type='button';toggle.className='cb-collapse-toggle';toggle.setAttribute('aria-controls',id);toggle.setAttribute('aria-expanded',String(expanded));toggle.textContent=expanded?'收合 −':'展開 ＋';
    toggle.addEventListener('click',()=>{content.hidden=!content.hidden;toggle.setAttribute('aria-expanded',String(!content.hidden));toggle.textContent=content.hidden?'展開 ＋':'收合 −';});
    heading.appendChild(toggle);
  }
  const returnButton = root.querySelector('#cb-watch-return');
  if(returnButton){
    returnButton.addEventListener('click',()=>root.querySelector('.cb-watch-panel')?.scrollIntoView({behavior:'smooth',block:'start'}));
    window.addEventListener('scroll',()=>{
      if(root.hidden){returnButton.hidden=true;return;}
      const panel=root.querySelector('.cb-watch-panel');
      returnButton.hidden=!panel||panel.getBoundingClientRect().top>-320;
    },{passive:true});
  }
  const pct = value => Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '—';
  const chipHtml=stock=>{
    if(!stock)return '<span>三大法人近20日 <b>待正股行情</b></span><span>集保大戶近4週 <b>待正股行情</b></span>';
    const live=window.cbChipMetrics?.(stock.code)||{};
    const saved=cbChipSnapshot?.stocks?.[stock.code]||{};
    const metrics={
      institutionalPercent:live.institutionalPercent??saved.institutionalPercent,
      institutionalDates:live.institutionalPercent!=null?live.institutionalDates:saved.institutionalDates,
      holderDeltaPp:live.holderDeltaPp??saved.holderDeltaPp,
      holderDates:live.holderDeltaPp!=null?live.holderDates:saved.holderDates,
    };
    const institutional=metrics.institutionalPercent;
    const large=metrics.holderDeltaPp;
    const flowTitle=metrics.institutionalDates?`三大法人淨買超張數 ÷ 同期正股成交量 × 100%；${metrics.institutionalDates.join(' → ')}`:'需有完整20個交易日法人日報與正股成交量';
    const holderTitle=metrics.holderDates?`400張以上大戶持股率變化（百分點）；${metrics.holderDates.join(' → ')}`:'需有相隔四週的集保週資料';
    return `<span title="${esc(flowTitle)}">三大法人近20日 <b>${institutional==null?'資料不足':pct(institutional)}</b></span><span title="${esc(holderTitle)}">集保大戶近4週 <b>${large==null?'資料不足':`${large>=0?'+':''}${large.toFixed(2)} 個百分點`}</b></span>`;
  };
  function showSearchResults(){
    const query=watchSearch.value.trim().toLowerCase();
    if(!query){watchSearch.focus();return;}
    const snapshot=window.cbStockSnapshot?.();
    const stocks=new Map((snapshot?.analyses||[]).map(stock=>[String(stock.code),stock]));
    const matches=allBonds.filter(bond=>`${bond.code} ${bond.name} ${bond.underlying_code}`.toLowerCase().includes(query));
    searchResults.innerHTML=matches.length?matches.slice(0,80).map(bond=>{
      const stock=stocks.get(String(bond.underlying_code));
      const conversion=bond.conversion_price_kind==='current_official'?Number(bond.conversion_price):null;
      const gap=stock&&conversion>0?(stock.t.close/conversion-1)*100:null;
      const bars=stock?.bars||[];
      const ma20=bars.length>=20?bars.slice(-20).reduce((sum,bar)=>sum+bar.close,0)/20:null;
      const ma60=bars.length>=60?bars.slice(-60).reduce((sum,bar)=>sum+bar.close,0)/60:null;
      const latest=bond.daily_bars?.at(-1);
      return `<article class="cb-watch-item"><div class="cb-watch-head">${stock?`<button type="button" data-cb-search-stock="${esc(stock.code)}">${esc(stock.code)} ${esc(stock.name)} ↗</button>`:`<strong>正股 ${esc(bond.underlying_code||'—')} · 日線待載入</strong>`}<span>${esc(bond.name||bond.code)} ${esc(bond.code)}</span></div><div class="cb-watch-metrics"><span class="cb-conversion-highlight">目前轉換價 <b>${conversion>0?fmt(conversion)+' 元':'待官方目前價格'}</b></span><span class="cb-stock-close-highlight">正股收盤 <b>${stock?fmt(stock.t.close):'待行情'}</b></span><span class="cb-stock-score-highlight">均線分數 <b>${stock?.score==null?'待補':`${stock.score}/15`}</b></span>${chipHtml(stock)}<span class="cb-conversion-highlight">正股距轉換價 <b>${gap===null?'—':pct(gap)}</b></span><span>${ma20===null?'MA20 待資料':stock.t.close>=ma20?'站上 MA20':'未站上 MA20'}</span><span>${ma60===null?'MA60 待資料':stock.t.close>=ma60?'站上 MA60':'未站上 MA60'}</span><span>CB ${latest?.date||'—'} 收市 ${latest?.close==null?'—':fmt(latest.close)} · 成交 ${latest?.volume==null?'—':fmt(latest.volume)} 單位</span></div></article>`;
    }).join(''):`<p>找不到「${esc(query)}」的可轉債資料。可輸入正股代號、名稱或 CB 代號。</p>`;
    searchResults.querySelectorAll('[data-cb-search-stock]').forEach(button=>button.addEventListener('click',()=>{
      const stock=stocks.get(button.dataset.cbSearchStock);
      searchDialog.close();
      if(stock&&typeof openStockDetail==='function')openStockDetail(stock,root.querySelector('#cb-search-confirm'));
    }));
    if(!searchDialog.open)searchDialog.showModal();
  }
  root.querySelector('#cb-search-form').addEventListener('submit',event=>{event.preventDefault();showSearchResults();});
  root.querySelector('#cb-search-close').addEventListener('click',()=>searchDialog.close());
  function renderWatchlist(){
    const snapshot=window.cbStockSnapshot?.();
    if(window.convertibleDataStatus!=='ready'){
      watchList.innerHTML='<p>可轉債資料尚未就緒。</p>';
      watchCount.textContent='等待 CB 資料';
      return;
    }
    if(snapshot?.mode!=='live'||!snapshot.analyses.length){
      const matching=allBonds.filter(bond=>bond.maturity_date>=today());
      watchList.innerHTML=`<p>正股盤後行情暫時未載入；先顯示可轉債官方基本資料，價差及均線待正股行情恢復後計算。</p>${matching.slice(0,80).map(bond=>`<article class="cb-watch-item"><div class="cb-watch-head"><strong>${esc(bond.name||bond.code)} ${esc(bond.code)}</strong><span>正股 ${esc(bond.underlying_code||'—')}</span></div><div class="cb-watch-metrics"><span class="cb-conversion-highlight">目前轉換價 <b>${bond.conversion_price_kind==='current_official'?fmt(bond.conversion_price)+' 元':'待官方目前價格'}</b></span><span>到期 ${esc(bond.maturity_date)}</span><span>正股價差／MA20／MA60 待行情</span></div></article>`).join('')}`;
      watchCount.textContent=`${matching.length} 檔 CB · 等待正股行情`;
      return;
    }
    const stockByCode=new Map(snapshot.analyses.map(stock=>[String(stock.code),stock]));
    const groups=new Map();
    for(const bond of allBonds){
      if(!bond.underlying_code||!bond.maturity_date||bond.maturity_date<today()||bond.conversion_price_kind!=='current_official'||Number(bond.conversion_price)<=0||(bond.outstanding_amount!=null&&Number(bond.outstanding_amount)<=0))continue;
      const stock=stockByCode.get(String(bond.underlying_code));
      if(!stock)continue;
      const group=groups.get(stock.code)||{stock,bonds:[]};
      group.bonds.push(bond);
      groups.set(stock.code,group);
    }
    const candidates=[...groups.values()].map(({stock,bonds})=>{
      const bars=stock.bars||[],last=bars.at(-1);
      if(!last)return null;
      const ma5=bars.length>=5?bars.slice(-5).reduce((sum,bar)=>sum+bar.close,0)/5:null;
      const ma20=bars.length>=20?bars.slice(-20).reduce((sum,bar)=>sum+bar.close,0)/20:null;
      const ma60=bars.length>=60?bars.slice(-60).reduce((sum,bar)=>sum+bar.close,0)/60:null;
      const move5=bars.length>=6&&bars.at(-6).close>0?(last.close/bars.at(-6).close-1)*100:null;
      const sideways=move5!==null&&move5>=-3&&move5<=5;
      const above5=ma5!==null&&last.close>=ma5;
      const above20=ma20!==null&&last.close>=ma20;
      const above60=ma60!==null&&last.close>=ma60;
      const matches=bonds.map(bond=>({bond,distance:(last.close/Number(bond.conversion_price)-1)*100}))
        .filter(item=>item.distance>=-50&&item.distance<=5)
        .sort((a,b)=>b.distance-a.distance);
      return {stock,bonds,matches,move5,ma5,ma20,ma60,sideways,above5,above20,above60,watch:sideways&&above5};
    }).filter(Boolean).sort((a,b)=>Number(b.watch)-Number(a.watch)||b.matches.length-a.matches.length||a.stock.code.localeCompare(b.stock.code));
    const gapRanges={gap0to10:{min:0,max:10,label:'0～10%'},gap11to20:{min:10,max:20,label:'11～20%'},gap21to50:{min:20,max:50,label:'21～50%'},gapAbove0to5:{min:0,max:5,label:'0～5%',above:true}};
    const range=gapRanges[watchFilter.value];
    const inRange=match=>range&&(range.above?match.distance>=0&&match.distance<=range.max:match.distance>=-range.max&&(range.min===0?match.distance<=0:match.distance< -range.min));
    const shown=candidates.filter(item=>watchFilter.value==='all'||(range?item.matches.some(inRange):item.watch));
    watchCount.textContent=range?`${shown.length} 檔${range.above?'高於':'低於'}轉換價 ${range.label}／${candidates.length} 檔有 CB 正股`:`${shown.length} 檔／${candidates.length} 檔有 CB 正股`;
    watchList.innerHTML=shown.slice(0,80).map(({stock,bonds,matches,move5,ma5,ma20,ma60,sideways,above5,above20,above60,watch})=>{
      const displayed=range?matches.filter(inRange):bonds.map(bond=>({bond,distance:(stock.t.close/Number(bond.conversion_price)-1)*100}));
      const cbLines=displayed.map(({bond,distance})=>{
        const daily=bond.daily_bars||[];
        const latest=daily.at(-1);
        const signal=cbVolumeSignals(daily);
        const priceLabel=`目前轉換價 ${esc(bond.conversion_price_date||'')}`;
        const ratio=signal.ratio20===null?'待 20 日量':`${signal.ratio20.toFixed(2)} 倍${signal.abnormal?' · 異常放量':''}`;
        const continuous=signal.ratio3===null?'待 6 日量':`${signal.ratio3.toFixed(2)} 倍${signal.continuous?' · 連續放量':''}`;
        const priorClose=[...daily].slice(0,-1).reverse().find(bar=>Number.isFinite(Number(bar.close))&&Number(bar.close)>0)?.close;
        const cbTrend=latest?.close!=null&&priorClose!=null?Number(latest.close)>Number(priorClose)?'CB 價格上行':'CB 價格未上行':'CB 價格待資料';
        return `<div class="cb-watch-bond"><strong>${esc(bond.name||bond.code)} ${esc(bond.code)}</strong><span class="cb-conversion-highlight">${priceLabel} <b>${fmt(bond.conversion_price)} 元</b> · 正股距離 <b>${pct(distance)}</b></span><span>CB ${latest?.date||'—'} 收市 ${latest?.close==null?'—':fmt(latest.close)} · 成交 ${latest?.volume==null?'—':fmt(latest.volume)} 單位</span><span>20 日量比 ${ratio} · 3 日量比 ${continuous} · ${cbTrend}</span></div>`;
      }).join('');
      return `<article class="cb-watch-item"><div class="cb-watch-head"><button type="button" data-cb-stock="${esc(stock.code)}">${esc(stock.code)} ${esc(stock.name)}</button><span class="${watch?'cb-watch-ready':'cb-watch-pending'}">${watch?'正股蓄勢':'正股條件未齊'}</span></div><div class="cb-watch-metrics"><span class="cb-stock-close-highlight">收盤 <b>${fmt(stock.t.close)}</b></span><span class="cb-stock-score-highlight">均線分數 <b>${stock.score==null?'待補':`${stock.score}/15`}</b></span>${chipHtml(stock)}<span>MA5 ${ma5===null?'—':ma5.toFixed(2)}</span><span>MA20 ${ma20===null?'—':ma20.toFixed(2)}</span><span>MA60 ${ma60===null?'—':ma60.toFixed(2)}</span></div><div class="cb-watch-checks"><span class="${sideways?'pass':'miss'}">${sideways?'✓':'○'} 尚未大漲</span><span class="${above5?'pass':'miss'}">${above5?'✓':'○'} 站上 MA5</span><span class="${ma20===null?'unknown':above20?'pass':'miss'}">${ma20===null?'○ MA20 資料不足':above20?'✓ 站上 MA20':'○ 未站上 MA20'}</span><span class="${ma60===null?'unknown':above60?'pass':'miss'}">${ma60===null?'○ MA60 資料不足':above60?'✓ 站上 MA60':'○ 未站上 MA60'}</span></div>${cbLines}</article>`;
    }).join('')||'<p>目前沒有符合條件的個股；可切換「全部有 CB 正股」。</p>';
    watchList.querySelectorAll('[data-cb-stock]').forEach(button=>button.addEventListener('click',()=>{const stock=stockByCode.get(button.dataset.cbStock);if(stock&&typeof openStockDetail==='function')openStockDetail(stock,button);}));
  }
  watchFilter.addEventListener('change',renderWatchlist);
  window.addEventListener('stock-data-ready',renderWatchlist);
  window.addEventListener('cb-chip-data-ready',()=>{renderWatchlist();if(searchDialog.open)showSearchResults();});
  fetch('cb-chip-data.json?v=20261012-196',{cache:'no-store'})
    .then(response=>{if(!response.ok)throw Error('CB 籌碼快照尚未建立');return response.json();})
    .then(data=>{if(!data.stocks)throw Error('CB 籌碼快照格式錯誤');cbChipSnapshot=data;renderWatchlist();if(searchDialog.open)showSearchResults();})
    .catch(error=>{console.warn('CB 籌碼快照載入失敗',error);});
  fetch('convertible-data.json?v=' + Date.now(), {cache:'no-store'})
    .then(response => { if (!response.ok) throw Error('月資料尚未建立'); return response.json(); })
    .then(data => {
      if (!Array.isArray(data.bonds) || !data.bonds.length || !data.period) throw Error('月資料尚未取得');
      const bonds = [...data.bonds].sort((a,b) => (b.custody ?? -1) - (a.custody ?? -1) || a.code.localeCompare(b.code));
      allBonds = bonds;
      window.convertibleDataStatus = 'ready';
      window.dispatchEvent(new Event('convertible-data-ready'));
      renderWatchlist();
      status.innerHTML = `<strong>CB 日價量 ${esc(data.daily?.as_of||'待更新')} · ${fmt(data.daily?.covered)}／${fmt(data.daily?.active)} 檔；集保月報 ${esc(data.period)}</strong><span>每日價量來自櫃買中心，轉換價只採用集保公布的目前價格；${bonds.filter(bond=>bond.conversion_price_kind==='current_official').length} 檔具目前轉換價。缺少目前價格者不參與價差篩選。</span>`;
      root.querySelector('#cb-data-period').textContent = data.period;
      panel.hidden = false;
      const search = root.querySelector('#cb-data-search');
      const body = root.querySelector('#cb-data-rows');
      const render = () => {
        const term = search.value.trim().toLowerCase();
        const shown = bonds.filter(bond => !term || `${bond.code} ${bond.name} ${bond.underlying_code}`.toLowerCase().includes(term));
        body.innerHTML = shown.map(bond => `<tr><td><strong>${esc(bond.name)}</strong><small>${esc(bond.code)} · 正股 ${esc(bond.underlying_code || '—')}</small></td><td>${fmt(bond.custody)} 張</td><td class="${bond.change > 0 ? 'cb-up' : bond.change < 0 ? 'cb-down' : ''}">${bond.change == null ? '—' : `${bond.change > 0 ? '+' : ''}${fmt(bond.change)} 張`}</td><td>${fmt(bond.issued)} 張</td><td>${fmt(bond.holders)}</td></tr>`).join('') || '<tr><td colspan="5">沒有符合的可轉債。</td></tr>';
      };
      search.addEventListener('input', render);
      render();
    })
    .catch(error => { window.convertibleDataStatus = 'error'; window.dispatchEvent(new Event('convertible-data-ready')); renderWatchlist(); status.innerHTML = `<strong>集保可轉債月資料暫時無法顯示</strong><span>${esc(error.message)}；研究規則仍可查看，未產生任何推估排行。</span>`; });
})();






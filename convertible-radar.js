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
    <section class="cb-panel cb-watch-panel"><div class="cb-panel-heading"><div><span class="cb-kicker">波段策略 · 正股觀察</span><h2>CB 對照正股蓄勢名單</h2></div><small id="cb-watch-count">資料載入中</small></div><p class="cb-data-note">CB 異常放量＝當日成交單位 ÷ 前 20 個交易日均量 ≥ 3；連續放量＝近 3 日總量 ÷ 再前 3 日總量 ≥ 2。等價與議價成交單位加總；無成交日計 0，均量不含當日。價差篩選只採用集保公布的目前轉換價格；沒有目前價格的可轉債不列入。</p><div class="cb-watch-controls"><label>顯示 <select id="cb-watch-filter"><option value="below20">正股低於轉換價 0～20%</option><option value="below10">正股低於轉換價 0～10%</option><option value="below30">正股低於轉換價 0～30%</option><option value="watch">正股蓄勢</option><option value="all">全部有 CB 正股</option></select></label><label>搜尋 <input id="cb-watch-search" type="search" placeholder="代號、名稱或 CB 代號"></label></div><div id="cb-watch-list" class="cb-watch-list" aria-live="polite"><p>正在對照可轉債與正股行情…</p></div></section>
    <section class="cb-panel" id="cb-data-panel" hidden><div class="cb-panel-heading"><div><span class="cb-kicker">官方資料</span><h2>可轉債保管月報</h2></div><small id="cb-data-period"></small></div><p class="cb-data-note">按本月底集保保管張數排序；月資料不代表今日成交量。發行張數為發行規模，並非剩餘流通張數。</p><label class="cb-search-label">搜尋代號或名稱 <input id="cb-data-search" type="search" placeholder="輸入可轉債或正股代號"></label><div class="cb-table-wrap"><table class="cb-table"><thead><tr><th>可轉債／正股</th><th>本月底保管</th><th>較前月</th><th>發行張數</th><th>集保戶數</th></tr></thead><tbody id="cb-data-rows"></tbody></table></div><p class="cb-data-note">資料來源：<a href="https://data.gov.tw/dataset/11462" target="_blank" rel="noopener">集保結算所可轉換公司債月分析表</a>。缺值以「—」表示。</p></section><button id="cb-watch-return" class="cb-watch-return" type="button" hidden>↑ 返回</button>`;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fmt = value => value == null ? '—' : Number(value).toLocaleString('zh-TW');
  let allBonds = [];
  const today = () => { const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part => [part.type,part.value])); return `${parts.year}-${parts.month}-${parts.day}`; };
  window.convertibleDataStatus = 'loading';
  window.activeConvertibleBonds = code => allBonds.filter(bond => bond.underlying_code === String(code) && bond.maturity_date && bond.maturity_date >= today() && bond.conversion_price_kind === 'current_official' && Number(bond.conversion_price) > 0 && (bond.outstanding_amount == null || Number(bond.outstanding_amount) > 0));
  const status = root.querySelector('#cb-data-status');
  const panel = root.querySelector('#cb-data-panel');
  const watchList = root.querySelector('#cb-watch-list');
  const watchCount = root.querySelector('#cb-watch-count');
  const watchFilter = root.querySelector('#cb-watch-filter');
  const watchSearch = root.querySelector('#cb-watch-search');
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
  function renderWatchlist(){
    const snapshot=window.cbStockSnapshot?.();
    if(window.convertibleDataStatus!=='ready'){
      watchList.innerHTML='<p>可轉債資料尚未就緒。</p>';
      watchCount.textContent='等待 CB 資料';
      return;
    }
    if(snapshot?.mode!=='live'||!snapshot.analyses.length){
      watchList.innerHTML='<p>請先載入官方盤後正股行情。</p>';
      watchCount.textContent='等待正股行情';
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
      const priorHigh=bars.length>=21?Math.max(...bars.slice(-21,-1).map(bar=>bar.high)):null;
      const move5=bars.length>=6&&bars.at(-6).close>0?(last.close/bars.at(-6).close-1)*100:null;
      const sideways=move5!==null&&move5>=-3&&move5<=5;
      const above5=ma5!==null&&last.close>=ma5;
      const belowHigh=priorHigh!==null&&last.close<=priorHigh;
      const matches=bonds.map(bond=>({bond,distance:(last.close/Number(bond.conversion_price)-1)*100}))
        .filter(item=>item.distance>=-30&&item.distance<=0)
        .sort((a,b)=>b.distance-a.distance);
      return {stock,bonds,matches,move5,ma5,priorHigh,sideways,above5,belowHigh,watch:sideways&&above5&&belowHigh};
    }).filter(Boolean).sort((a,b)=>Number(b.watch)-Number(a.watch)||b.matches.length-a.matches.length||a.stock.code.localeCompare(b.stock.code));
    const query=watchSearch.value.trim().toLowerCase();
    const threshold=watchFilter.value==='below10'?10:watchFilter.value==='below30'?30:20;
    const isBelow=watchFilter.value.startsWith('below');
    const shown=candidates.filter(item=>(watchFilter.value==='all'||(isBelow?item.matches.some(match=>match.distance>=-threshold):item.watch))&&(!query||`${item.stock.code} ${item.stock.name} ${item.bonds.map(bond=>`${bond.code} ${bond.name}`).join(' ')}`.toLowerCase().includes(query)));
    watchCount.textContent=`${candidates.filter(item=>item.matches.some(match=>match.distance>=-threshold)).length} 檔低於轉換價 0～${threshold}%／${candidates.length} 檔有 CB 正股`;
    watchList.innerHTML=shown.slice(0,80).map(({stock,bonds,matches,move5,ma5,priorHigh,sideways,above5,belowHigh,watch})=>{
      const displayed=isBelow?matches.filter(match=>match.distance>=-threshold):bonds.map(bond=>({bond,distance:(stock.t.close/Number(bond.conversion_price)-1)*100}));
      const cbLines=displayed.map(({bond,distance})=>{
        const daily=bond.daily_bars||[];
        const latest=daily.at(-1);
        const signal=cbVolumeSignals(daily);
        const priceLabel=`目前轉換價 ${esc(bond.conversion_price_date||'')}`;
        const ratio=signal.ratio20===null?'待 20 日量':`${signal.ratio20.toFixed(2)} 倍${signal.abnormal?' · 異常放量':''}`;
        const continuous=signal.ratio3===null?'待 6 日量':`${signal.ratio3.toFixed(2)} 倍${signal.continuous?' · 連續放量':''}`;
        return `<div class="cb-watch-bond"><strong>${esc(bond.name||bond.code)} ${esc(bond.code)}</strong><span>${priceLabel} ${fmt(bond.conversion_price)} 元 · 正股距離 ${pct(distance)}</span><span>CB ${latest?.date||'—'} 收市 ${latest?.close==null?'—':fmt(latest.close)} · 成交 ${latest?.volume==null?'—':fmt(latest.volume)} 單位</span><span>20 日量比 ${ratio} · 3 日量比 ${continuous}</span></div>`;
      }).join('');
      return `<article class="cb-watch-item"><div class="cb-watch-head"><button type="button" data-cb-stock="${esc(stock.code)}">${esc(stock.code)} ${esc(stock.name)}</button><span class="${watch?'cb-watch-ready':'cb-watch-pending'}">${watch?'正股蓄勢':'正股條件未齊'}</span></div><div class="cb-watch-metrics"><span>近 5 日 ${pct(move5)}</span><span>收盤 ${fmt(stock.t.close)}</span><span>MA5 ${ma5===null?'—':ma5.toFixed(2)}</span><span>前 20 日高 ${priorHigh===null?'—':priorHigh.toFixed(2)}</span></div><div class="cb-watch-checks"><span class="${sideways?'pass':'miss'}">${sideways?'✓':'○'} 尚未大漲</span><span class="${above5?'pass':'miss'}">${above5?'✓':'○'} 站上 MA5</span><span class="${belowHigh?'pass':'miss'}">${belowHigh?'✓':'○'} 未破 20 日高</span></div>${cbLines}</article>`;
    }).join('')||'<p>目前沒有符合條件的個股；可切換「全部有 CB 正股」。</p>';
    watchList.querySelectorAll('[data-cb-stock]').forEach(button=>button.addEventListener('click',()=>{const stock=stockByCode.get(button.dataset.cbStock);if(stock&&typeof openStockDetail==='function')openStockDetail(stock,button);}));
  }
  watchFilter.addEventListener('change',renderWatchlist);
  watchSearch.addEventListener('input',renderWatchlist);
  window.addEventListener('stock-data-ready',renderWatchlist);
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






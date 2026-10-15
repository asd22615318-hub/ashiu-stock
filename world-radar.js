(() => {
  'use strict';
  const groups = [
    { id:'indices', title:'美股指數', items:[['^DJI','道瓊工業'],['^GSPC','標普 500'],['^IXIC','那斯達克'],['^NDX','那斯達克 100'],['^SOX','費城半導體'],['^RUT','羅素 2000'],['^VIX','VIX 恐慌指數']] },
    { id:'leaders', title:'美股權值與台股供應鏈', items:[['NVDA','輝達'],['AAPL','蘋果'],['MSFT','微軟'],['GOOGL','Alphabet'],['AMZN','亞馬遜'],['META','Meta'],['TSLA','特斯拉'],['AVGO','博通'],['AMD','超微'],['MU','美光'],['INTC','英特爾'],['QCOM','高通'],['ASML','艾司摩爾'],['ARM','安謀'],['ORCL','甲骨文'],['SMCI','美超微']] },
    { id:'adr', title:'台股相關 ADR', items:[['TSM','台積電 ADR'],['UMC','聯電 ADR'],['ASX','日月光 ADR'],['CHT','中華電 ADR']] },
    { id:'asia', title:'亞洲與歐洲股市', items:[['^N225','日經 225'],['^HSI','恆生指數'],['000001.SS','上證綜指'],['^KS11','韓國綜合'],['^FTSE','英國 FTSE'],['^GDAXI','德國 DAX'],['^FCHI','法國 CAC']] },
    { id:'macro', title:'匯率、利率與原物料', items:[['TWD=X','美元／新台幣'],['JPY=X','美元／日圓'],['^TNX','美國 10 年債殖利率'],['GC=F','黃金期貨'],['CL=F','WTI 原油期貨'],['BTC-USD','比特幣']] }
  ];
  const chain = {
    NVDA:['AI 伺服器','先進封裝','散熱／風扇','電源供應器','PCB－ABF 載板'],
    AAPL:['手機鏡頭','電子代工','PCB－銅箔基板','連接器','被動元件'],
    MSFT:['AI 伺服器','資料中心網通','矽光子／光通訊','電源供應器'],
    GOOGL:['AI 伺服器','ASIC／IP','資料中心網通','散熱／風扇'],
    AMZN:['AI 伺服器','ASIC／IP','資料中心網通','電源供應器'],
    META:['AI 伺服器','矽光子／光通訊','散熱／風扇','PCB－銅箔基板'],
    TSLA:['車用電子','車用電池模組','充電樁','功率元件'],
    AVGO:['ASIC／IP','資料中心網通','矽光子／光通訊','先進封裝'],
    AMD:['晶圓代工','先進封裝','AI 伺服器','PCB－ABF 載板'],
    MU:['DRAM','記憶體設計／利基型','半導體封測'],
    INTC:['晶圓代工','先進封裝','半導體設備'],
    QCOM:['IC 設計','手機供應鏈','射頻／濾波器'],
    ASML:['半導體設備','半導體特用材料','晶圓代工'],
    ARM:['IC 設計','IP 股','晶圓代工'],
    ORCL:['AI 伺服器','資料中心網通','電源供應器'],
    SMCI:['AI 伺服器','散熱／風扇','電源供應器','PCB－銅箔基板']
  };
  const root = document.getElementById('world');
  if (!root) return;
  const style = document.createElement('style');
  style.textContent = `
    body:has(#world:not([hidden])) main>.heading,body:has(#world:not([hidden])) main>.notice,body:has(#world:not([hidden])) main>#message{display:none}
    #world{max-width:1500px;margin:0 auto;padding:14px 0 70px;color:#e5e9ee}#world[hidden]{display:none}
    .world-head,.world-panel{background:#1d252c;border:1px solid #526056;border-radius:20px;padding:24px;margin:16px 0;box-shadow:0 10px 28px #0002}
    .world-head h1{color:#e7c776;font-size:clamp(26px,3vw,38px);margin:0 0 7px}.world-head p,.world-note{color:#b9c4c5;line-height:1.6;margin:6px 0}
    .world-controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:17px}.world-controls button{background:#143931;color:#d6f4e9;border:1px solid #4d8d7e;border-radius:10px;padding:9px 14px;font:inherit;cursor:pointer}.world-controls button:hover{background:#20584b}
    .world-panel h2{font-size:23px;color:#eed594;margin:0 0 14px}.world-panel details summary{cursor:pointer;color:#eed594;font-size:21px;font-weight:700}
    .world-table-wrap{overflow-x:auto}.world-table{width:100%;border-collapse:collapse;min-width:780px;font-size:15px}.world-table th{text-align:right;color:#aec5c4;border-bottom:1px solid #547069;padding:10px 8px;white-space:nowrap}.world-table th:first-child,.world-table td:first-child{text-align:left}.world-table td{text-align:right;border-bottom:1px solid #344640;padding:11px 8px;white-space:nowrap}.world-table tr:hover{background:#294039}.world-name{font-weight:700;color:#f3e4b9}.world-sym{display:block;font-size:12px;color:#9cb1b1}.world-pos{color:#f18d91}.world-neg{color:#62d8b3}.world-muted{color:#a8b4b3}.world-date{font-size:12px;color:#9cacaa}
    .world-chain{display:flex;flex-wrap:wrap;gap:5px;max-width:380px;text-align:left}.world-chain span{display:inline-block;background:#1c4b42;border:1px solid #477e70;color:#c8eee0;border-radius:999px;padding:3px 7px;font-size:12px;white-space:nowrap}
    .world-mini{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.world-mini article{border:1px solid #4d625e;border-radius:12px;padding:14px;background:#122a2b}.world-mini small{color:#abbdbc;display:block}.world-mini strong{display:block;font-size:24px;color:#f0d28c;margin-top:5px}.world-mini em{font-style:normal;font-size:14px}
    .world-fx-card{grid-column:span 2}.world-fx-impact{margin-top:8px;color:#d8e6df;font-size:13px;line-height:1.55;white-space:normal}.world-fx-impact b{color:#f0d28c}.world-fx-impact span{display:block}.world-fx-row-impact{max-width:270px}
    .world-fail{color:#f2ae8a}.world-source a{color:#8edaca}
    .world-ma,.world-move{display:flex;flex-direction:column;align-items:flex-end;gap:3px;font-weight:700}.world-ma span,.world-move span{white-space:nowrap}.world-move small{font-size:12px;color:inherit;opacity:.84}
    @media(max-width:680px){.world-head,.world-panel{padding:16px;margin:12px 0}.world-table{font-size:13px}.world-table td,.world-table th{padding:8px 5px}.world-fx-card{grid-column:auto}}
  `;
  document.head.appendChild(style);
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cache = new Map();
  let inFlight=0;
  const waiting=[];
  async function queuedFetch(url){
    if(inFlight>=5)await new Promise(resolve=>waiting.push(resolve));
    inFlight++;
    try{return await fetch(url,{credentials:'same-origin'});}finally{inFlight--;waiting.shift()?.();}
  }
  const pct = n => Number.isFinite(n) ? `${n>0?'+':''}${n.toFixed(2)}%` : '—';
  const cls = n => Number.isFinite(n) ? n>0?'world-pos':n<0?'world-neg':'world-muted' : 'world-muted';
  const val = n => Number.isFinite(n) ? n.toLocaleString('en-US',{maximumFractionDigits:2,minimumFractionDigits:2}) : '—';
  const signedVal = n => Number.isFinite(n) ? `${n>0?'+':''}${n.toLocaleString('en-US',{minimumFractionDigits:Math.abs(n)<1?3:2,maximumFractionDigits:Math.abs(n)<1?3:2})}` : '—';
  const unit = (symbol,currency) => symbol==='^TNX'?'個百分點':symbol.startsWith('^')||symbol==='000001.SS'?'點':currency||'';
  const move = (amount,percent,symbol,currency) => `<div class="world-move ${cls(percent)}"><span>${signedVal(amount)} ${esc(unit(symbol,currency))}</span><small>${pct(percent)}</small></div>`;
  function fxImpact(change) {
    if (!Number.isFinite(change)) return '';
    if (change===0) return '<div class="world-fx-impact"><b>美元／台幣持平</b><span>匯率本日沒有明顯方向訊號。</span></div>';
    const weakerTwd=change>0;
    return `<div class="world-fx-impact"><b>${weakerTwd?'美元升、台幣貶':'美元跌、台幣升'}</b><span>相對受惠：${weakerTwd?'出口導向族群的台幣營收換算':'進口原料與能源成本較高的族群'}。</span><span>相對承壓：${weakerTwd?'進口原料與能源成本較高的族群':'出口導向族群的台幣營收換算'}。</span></div>`;
  }
  const maPosition = (close,average,label) => Number.isFinite(average) ? `<span class="${cls(close-average)}">${label} ${close>average?'站上':close<average?'跌破':'持平'}</span>` : `<span class="world-muted">${label} 資料不足</span>`;
  function metric(data) {
    const b=data.bars, latest=b.at(-1), close=latest.close, previous=b.at(-2)?.close;
    const change=previous ? (close/previous-1)*100 : NaN;
    const base=n => b.length>n ? b.at(-1-n).close : NaN;
    const period=n => Number.isFinite(base(n)) ? (close/base(n)-1)*100 : NaN;
    const ma=n => b.length>=n ? b.slice(-n).reduce((sum,x)=>sum+x.close,0)/n : NaN;
    const high=Math.max(...b.map(x=>x.close));
    const year=new Date(latest.time*1000).getUTCFullYear(), yearBase=b.filter(x=>new Date(x.time*1000).getUTCFullYear()<year).at(-1)?.close;
    return { close, change, changeValue:close-previous, week:period(5), weekValue:close-base(5), month:period(20), monthValue:close-base(20), quarter:period(60), quarterValue:close-base(60), ytd:yearBase?(close/yearBase-1)*100:NaN, ytdValue:close-yearBase, fromHigh:(close/high-1)*100, fromHighValue:close-high, ma20:ma(20), ma60:ma(60), date:new Intl.DateTimeFormat('zh-TW',{timeZone:data.exchangeTimezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(latest.time*1000)), currency:data.currency };
  }
  function row(item, groupId) {
    const [symbol,name]=item, data=cache.get(symbol), m=data?.bars?.length?metric(data):null;
    const supply=groupId==='leaders'?`<td><div class="world-chain">${(chain[symbol]||[]).map(x=>`<span>${esc(x)}</span>`).join('')}</div></td>`:'';
    if (!m) return `<tr><td><span class="world-name">${esc(name)}</span><span class="world-sym">${esc(symbol)}</span></td><td colspan="${groupId==='leaders'?9:8}" class="world-fail">${data?.error?esc(data.error):'讀取中…'}</td></tr>`;
    return `<tr><td><span class="world-name">${esc(name)}</span><span class="world-sym">${esc(symbol)} · ${esc(m.currency)} · <span class="world-date">${esc(m.date)}</span></span>${symbol==='TWD=X'?`<div class="world-fx-row-impact">${fxImpact(m.change)}</div>`:''}</td><td><strong>${val(m.close)}</strong></td><td>${move(m.changeValue,m.change,symbol,m.currency)}</td><td>${move(m.weekValue,m.week,symbol,m.currency)}</td><td>${move(m.monthValue,m.month,symbol,m.currency)}</td><td>${move(m.quarterValue,m.quarter,symbol,m.currency)}</td><td>${move(m.ytdValue,m.ytd,symbol,m.currency)}</td><td>${move(m.fromHighValue,m.fromHigh,symbol,m.currency)}</td><td><div class="world-ma">${maPosition(m.close,m.ma20,'MA20')}${maPosition(m.close,m.ma60,'MA60')}</div></td>${supply}</tr>`;
  }
  function paintGroup(g) {
    const node=root.querySelector(`[data-world-table="${g.id}"]`);if(node)node.innerHTML=g.items.map(item=>row(item,g.id)).join('');
  }
  function paintBrief(){const node=root.querySelector('#world-brief');if(!node)return;node.innerHTML=[['^DJI','道瓊工業'],['^SOX','費城半導體'],['^IXIC','那斯達克'],['NVDA','輝達'],['TSM','台積電 ADR'],['^VIX','VIX'],['^TNX','美國 10 年債殖利率'],['TWD=X','美元／新台幣']].map(([symbol,name])=>{const data=cache.get(symbol),m=data?.bars?.length?metric(data):null;return `<article class="${symbol==='TWD=X'?'world-fx-card':''}"><small>${esc(name)} · ${esc(symbol)}</small><strong>${m?val(m.close):'—'}</strong><em class="${m?cls(m.change):'world-muted'}">${m?`${signedVal(m.changeValue)} ${esc(unit(symbol,m.currency))} (${pct(m.change)})`:'等待行情'}</em><small>${m?esc(m.date):''}</small>${symbol==='TWD=X'&&m?fxImpact(m.change):''}</article>`}).join('')}
  async function load(g) {
    const pending=g.items.filter(([symbol])=>!cache.has(symbol));
    await Promise.all(pending.map(async ([symbol])=>{try{const response=await queuedFetch(`/api/world?symbol=${encodeURIComponent(symbol)}`);const data=await response.json();cache.set(symbol,response.ok?data:{error:data.error||'行情來源無法讀取'});}catch(error){cache.set(symbol,{error:'連線失敗，請稍後重試'});}paintGroup(g);paintBrief()}));
  }
  function init(){
    root.innerHTML=`<div class="world-head"><h1>國際數據</h1><p>追蹤美股、台股 ADR、全球指數及關鍵市場價格，並對照可能受影響的台股產業族群。</p><div class="world-controls"><button type="button" id="world-refresh">重新載入國際行情</button><span class="world-note">各市場收盤時間不同；每筆資料顯示各自日期。資料約每 30 分鐘快取更新。</span></div></div><div class="world-panel"><h2>開盤前重點</h2><div class="world-mini" id="world-brief"></div></div>${groups.map((g,i)=>`<div class="world-panel" id="world-${g.id}"><details ${i<3?'open':''} data-world-group="${g.id}"><summary>${esc(g.title)}</summary><div class="world-table-wrap"><table class="world-table"><thead><tr><th>標的／日期</th><th>收盤</th><th>單日</th><th>5 日</th><th>20 日</th><th>60 日</th><th>今年</th><th>距一年收盤高點</th><th>MA20／60 位置</th>${g.id==='leaders'?'<th>台股關聯族群</th>':''}</tr></thead><tbody data-world-table="${g.id}"></tbody></table></div></details></div>`).join('')}<div class="world-panel world-source"><p class="world-note">價格資料：Yahoo Finance 日線；各標的依當地交易日計算。均線位置以最新收盤價與 MA20、MA60 比較。台股族群為產品與資本支出方向的產業關聯，不能據此認定個別公司已取得訂單或為直接供應商。不同市場幣別不可直接比較價格。美元／新台幣的族群影響是一般換算與成本方向，實際效果仍受企業避險、美元收入及進口成本影響，不能據此推論台股大盤漲跌；參考 <a href="https://knowledge.cbc.gov.tw/front/references/inpage/91736075-AF4C-F011-9116-0050569481A8" target="_blank" rel="noopener">中央銀行說明</a>。</p><p class="world-note">呈現方式參考 <a href="https://zhuang.tw/world" target="_blank" rel="noopener">國際股市・收盤一覽</a>；歷史行情與供應鏈對應僅供研究，不代表投資建議。</p></div>`;
    root.querySelector('#world-refresh').addEventListener('click',()=>{cache.clear();groups.filter(g=>g.id==='indices'||g.id==='leaders'||g.id==='adr'||root.querySelector(`[data-world-group="${g.id}"]`).open).forEach(load)});
    root.querySelectorAll('[data-world-group]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open){const g=groups.find(x=>x.id===d.dataset.worldGroup);if(g)load(g)}}));
    groups.forEach(paintGroup);paintBrief();groups.filter(g=>g.id!=='asia').forEach(load);
  }
  let initialized=false;
  document.querySelectorAll('.nav').forEach(button=>button.addEventListener('click',()=>{
    root.hidden=button.dataset.view!=='world';
    if(!root.hidden&&!initialized){initialized=true;init()}
  }));
})();


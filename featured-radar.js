(() => {
  'use strict';
  const mean = (bars, key) => bars.reduce((sum, bar) => sum + bar[key], 0) / bars.length;
  const high = bars => Math.max(...bars.map(bar => bar.high));
  const low = bars => Math.min(...bars.map(bar => bar.low));
  const epsilon = 1e-9;

  function evaluate(bars, relativeStrength) {
    if (bars.length < 21) return [];
    const recent = bars.slice(-25);
    const validBar = bar => [bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite) &&
      bar.low > 0 && bar.volume >= 0 && bar.low <= Math.min(bar.open, bar.close) &&
      bar.high >= Math.max(bar.open, bar.close);
    if (!recent.slice(-21).every(validBar)) return [];
    const fullHistory = recent.length === 25 && recent.slice(0, 4).every(validBar);

    const today = bars.at(-1), close = today.close;
    if (today.volume < 500) return [];
    const average = (period, offset = 0) => ma(bars, bars.length - 1 - offset, period);
    const ma5 = average(5), ma10 = average(10), ma20 = average(20);
    const last20 = bars.slice(-20), high20 = high(last20);
    const last10 = bars.slice(-10), priorHigh10 = high(bars.slice(-11, -1));
    const volume5 = mean(bars.slice(-5), 'volume');
    const priorVolume20 = mean(bars.slice(-21, -1), 'volume');
    const result = [];
    const highDistance = 1 - close / high20;

    if (bars.length >= 60) {
      const ma60 = average(60);
      const ma60Gap = close / ma60 - 1;
      const recentLow5 = low(last10.slice(-5));
      const previousLow5 = low(last10.slice(0, 5));
      const return10 = close / bars.at(-11).close - 1;
      if (close > ma60 && ma60Gap <= .12 + epsilon && recentLow5 > previousLow5 && return10 <= .15 + epsilon) {
        result.push({type:'A', evidence:[
          ['MA60', ma60, '元'], ['季線乖離', ma60Gap * 100, '%'], ['近 5 日最低價', recentLow5, '元'],
          ['前 5 日最低價', previousLow5, '元'], ['近 10 日漲幅', return10 * 100, '%']
        ]});
      }
    }

    const clv = today.high > today.low ? (close - today.low) / (today.high - today.low) : null;
    const rs5 = relativeStrength?.rs5;
    if (fullHistory && ma5 > ma10 && ma10 > ma20 && ma5 > average(5, 1) && ma20 > average(20, 1) &&
      close > priorHigh10 && priorVolume20 > 0 && today.volume >= priorVolume20 * 1.5 &&
      clv !== null && clv >= .75 - epsilon && Math.abs(close / ma5 - 1) <= .10 + epsilon && rs5 > epsilon) {
      result.push({type:'B', evidence:[
        ['前 10 日最高價', priorHigh10, '元'], ['今日量比', today.volume / priorVolume20, '倍'],
        ['收盤位置', clv * 100, '%'], ['近 5 日相對大盤', rs5, '百分點']
      ]});
    }

    const return20 = close / bars.at(-21).close - 1;
    const priorMA20 = average(20, 1);
    if (close > ma20 && ma20 > priorMA20 && return20 > .20 + epsilon &&
      highDistance >= .08 - epsilon && highDistance <= .20 + epsilon && today.volume < volume5) {
      result.push({type:'C', evidence:[
        ['今日 MA20', ma20, '元'], ['昨日 MA20', priorMA20, '元'], ['近 20 日漲幅', return20 * 100, '%'],
        ['距 20 日高點回檔', highDistance * 100, '%'], ['當日成交量', today.volume, '張'], ['5 日均量', volume5, '張']
      ]});
    }
    return result;
  }
  const root = document.getElementById('featured-radar');
  if (!root) return;
  const shell = root.querySelector('details');
  const content = root.querySelector('.chipburst-info');
  const names = {A:'提前起漲型', B:'突破飆股型', C:'強勢回檔型'};
  const rules = {
    A:'收盤價大於 MA60，且季線乖離（收盤價 ÷ MA60 − 1）不超過 12%。最近 5 日最低價高於再前 5 日最低價。近 10 個交易日漲幅（今日收盤價 ÷ 10 個交易日前收盤價 − 1）不超過 15%。最近 5 日區間包含當日。',
    B:'MA5 ＞ MA10 ＞ MA20，且 MA5、MA20 都高於前一日。收盤突破前 10 日最高價，當日成交量 ≥ 前 20 日均量的 1.5 倍。收盤位於當日高低區間上四分之一，高低同價不納入。收盤距 MA5 ≤ 10%，同交易日區間的個股 5 日報酬高於加權指數。',
    C:'收盤價大於 MA20，且今日 MA20 大於昨日 MA20。近 20 個交易日收盤漲幅大於 20%。收盤價較含當日的近 20 日最高價回落 8%～20%（含兩端）。紅 K、綠 K 皆可，當日成交量須低於含當日的 5 日均量。'
  };
  const style = document.createElement('style');
  style.textContent = "#featured-radar .fr-tabs{display:flex;gap:8px;flex-wrap:wrap}#featured-radar .fr-tabs button{padding:10px 14px;border:1px solid #806a3a;border-radius:8px;background:#183c35;color:#f3f4f6;font:inherit;cursor:pointer}#featured-radar .fr-tabs button[aria-pressed=true]{background:#6c4c1f;color:#ffe298;border-color:#ffe298}#featured-radar .fr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:14px;margin-top:16px}#featured-radar .fr-card{border:1px solid #705331;border-radius:12px;padding:16px;min-width:0;overflow-wrap:anywhere;background:#201824}#featured-radar .fr-name{border:0;background:none;padding:0;color:#ffe298;font-weight:800;font-size:19px;cursor:pointer;text-align:left}#featured-radar .fr-card p{color:#eee7ee;line-height:1.8;font-size:14px}#featured-radar .fr-card .fr-orange{color:#ffb36e;font-weight:700}#featured-radar .fr-note{font-size:13px;line-height:1.9;color:#cdd6df}#featured-radar .fr-common{border:1px solid #604b64;padding:12px;border-radius:9px;margin:12px 0}#featured-radar button:focus-visible{outline:2px solid #ffe298;outline-offset:3px}";
  document.head.appendChild(style);
  let tab = 'A';
  let activeRecords = null;
  let activeBenchmark = '';
  let date = '';
  let rows = [];

  function recalculate() {
    if (!shell.open) return;
    if (mode !== 'live' || !records.length) {
      content.textContent = '請先載入官方盤後行情。';
      return;
    }
    const benchmarkStatus = window.marketStrength.status;
    if (activeRecords !== records || activeBenchmark !== benchmarkStatus) {
      date = records.reduce((latest, stock) => {
        const day = stock.bars.at(-1)?.date;
        return day > latest ? day : latest;
      }, '');
      rows = analyses.flatMap(stock => stock.t.date === date
        ? evaluate(stock.bars, window.marketStrength.get(stock, date)).map(match => ({...match, stock}))
        : []);
      rows.sort((a, b) => (b.stock.score ?? -1) - (a.stock.score ?? -1) || a.stock.code.localeCompare(b.stock.code));
      activeRecords = records;
      activeBenchmark = benchmarkStatus;
    }
    const counts = Object.fromEntries(Object.keys(names).map(key => [key, rows.filter(row => row.type === key).length]));
    const filtered = rows.filter(row => row.type === tab);
    const cards = filtered.map(({stock, evidence}) =>
      '<article class="fr-card"><button type="button" class="fr-name" data-fr-stock="' + esc(stock.code) + '">' +
      esc(stock.name) + ' ' + esc(stock.code) + ' ↗</button><p class="fr-orange">收盤 ' + fmt(stock.t.close) +
      ' 元 · 均線 ' + (stock.score == null ? '待補' : stock.score + ' / 15') + '</p><p>' +
      evidence.map(([label, value, unit]) => esc(label) + ' ' + fmt(value) + ' ' + esc(unit)).join(' · ') + '</p></article>'
    ).join('');
    const rsPending = tab === 'B' && !benchmarkStatus.includes('已載入');
    content.innerHTML = '<div class="fr-tabs" role="group" aria-label="精選股分類">' +
      Object.entries(names).map(([key, label]) => '<button type="button" data-fr-tab="' + key +
        '" aria-pressed="' + (tab === key) + '">' +
        label + ' · ' + counts[key] + '</button>').join('') +
      '</div><p class="fr-note">行情日期 ' + esc(date) + ' · 當日成交量至少 500 張 · 依均線分數由高到低排序</p>' +
      '<details class="fr-common"><summary>查看' + names[tab] + '篩選條件</summary><p>' + rules[tab] + '</p></details>' +
      (rsPending ? '<p role="status">' + esc(benchmarkStatus) + '</p>' : '') +
      (cards ? '<div class="fr-grid">' + cards + '</div>' : '<p>' +
        (rsPending ? '待加權指數資料齊備後判定。' : '當日沒有符合全部條件的個股。') + '</p>');
    content.querySelectorAll('[data-fr-tab]').forEach(button => button.onclick = () => {
      tab = button.dataset.frTab;
      recalculate();
      content.querySelector('[data-fr-tab="' + tab + '"]')?.focus();
    });
    content.querySelectorAll('[data-fr-stock]').forEach(button => button.onclick = () => {
      openStockDetail(analyses.find(stock => stock.code === button.dataset.frStock), button);
    });
  }

  shell.addEventListener('toggle', () => {
    if (!shell.open) return;
    window.marketStrength.load();
    recalculate();
  });
  window.addEventListener('stock-data-ready', recalculate);
  window.addEventListener('market-strength-ready', recalculate);
})();

/* Independent strong-pullback shortlist, matched to the same five market sessions. */
(()=>{
 const root=document.getElementById('strong-picks');if(!root)return;
 const shell=root.querySelector('details'),content=root.querySelector('.chipburst-info');
 function technical(stock){
  const a=stock.bars,i=a.length-1;
  if(a.length<60||!Number.isFinite(stock.score)||stock.score<10)return null;
  if(a.slice(-60).some(b=>![b.close,b.high,b.volume].every(Number.isFinite)||b.close<=0||b.high<b.close||b.volume<0))return null;
  const close=a[i].close,m20=ma(a,i,20),m60=ma(a,i,60),prior20=ma(a,i-1,20);
  const top=Math.max(...a.slice(-20).map(b=>b.high)),drop=(top-close)/top;
  const v5=a.slice(-6,-1).reduce((sum,b)=>sum+b.volume,0)/5;
  if(!(close>m20&&close>m60&&m20>prior20&&drop>=.03-1e-9&&drop<=.15+1e-9&&a[i].volume<v5))return null;
  return {m20,m60,drop,volume5:v5};
 }
 function render(){
  if(!shell.open)return;
  if(mode!=='live'||!analyses.length){content.textContent='請先載入官方盤後行情。';return;}
  const dates=[...new Set(records.flatMap(s=>s.bars.slice(-5).map(b=>b.date)))].sort().slice(-5),end=dates.at(-1);
  let missing=0,technicalCount=0;
  const rows=[];
  for(const stock of analyses){
   if(stock.t.date!==end)continue;
   const t=technical(stock);if(!t)continue;technicalCount++;
   const reports=new Map((typeof institutional==='undefined'?[]:institutional?.stocks?.[stock.code]?.daily_history||[]).map(r=>[r.date,r]));
   const foreign=dates.map(d=>reports.get(d)?.foreign?.net);
   const broker=window.brokerFiveSession?.(stock,dates);
   if(dates.length!==5||!foreign.every(Number.isFinite)||!Number.isFinite(broker?.net)){missing++;continue;}
   const net=foreign.reduce((sum,v)=>sum+v,0);
   if(net>0&&broker.net>0)rows.push({stock,...t,foreign:net,broker:broker.net});
  }
  rows.sort((a,b)=>b.stock.score-a.stock.score||a.stock.code.localeCompare(b.stock.code));
  content.innerHTML='<p style="color:#dce5ef">行情 '+esc(end)+' · 籌碼 '+esc(dates[0]||'—')+'～'+esc(end)+' · '+rows.length+' 檔 · 均線分數由高到低</p><details><summary>篩選條件</summary><p style="color:#dce5ef">均線≥10／15；同一近5交易日外資累計淨買超＞0、每日前15大分點集中淨額累計＞0。收盤＞MA20及MA60、MA20高於昨日；距含當日近20日最高價回落3%～15%；當日量低於不含當日的前5日均量。分點為券商通路統計，非可識別的主力帳戶。</p></details>'+
   (missing?'<p role="status">技術條件符合 '+technicalCount+' 檔，其中 '+missing+' 檔近5日籌碼未齊，暫不列入；不以缺漏當0或舊日期替代。</p>':'')+
   (rows.length?'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;margin-top:14px">'+rows.map(r=>'<article style="border:1px solid #746346;border-radius:12px;padding:16px;min-width:0;overflow-wrap:anywhere"><button type="button" data-sp-code="'+esc(r.stock.code)+'" style="background:transparent;border:0;color:#ffe298;font-family:inherit;font-size:18px;font-weight:700;padding:0">'+esc(r.stock.code)+' '+esc(r.stock.name)+'</button><p style="color:#ffb36e;font-weight:700">均線 '+r.stock.score+'／15 · 收盤 '+fmt(r.stock.t.close)+'</p><p style="color:#dce5ef">回落 '+fmt(r.drop*100)+'% · 成交量 '+fmt(r.stock.t.volume,0)+' 張<br>前5日均量 '+fmt(r.volume5,0)+' 張<br>MA20 '+fmt(r.m20)+' ／MA60 '+fmt(r.m60)+'<br>外資5日 +'+fmt(r.foreign)+' 張<br>分點5日集中淨額 +'+fmt(r.broker)+' 張</p></article>').join('')+'</div>':'<p>目前沒有資料齊全且符合全部條件的個股。</p>');
  content.querySelectorAll('[data-sp-code]').forEach(button=>button.onclick=()=>{const stock=analyses.find(s=>s.code===button.dataset.spCode);if(stock)openStockDetail(stock,button);});
 }
 shell.addEventListener('toggle',render);
 ['stock-data-ready','cb-chip-data-ready','broker-data-ready'].forEach(event=>window.addEventListener(event,render));
 window.strongPullbackTechnical=technical;
})();

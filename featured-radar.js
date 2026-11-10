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
      const range10 = high(last10) / Math.min(recentLow5, previousLow5) - 1;
      if (close > ma60 && ma60Gap <= .12 + epsilon && recentLow5 > previousLow5 && range10 < .12 - epsilon) {
        result.push({type:'A', evidence:[
          ['MA60', ma60, '元'], ['季線乖離', ma60Gap * 100, '%'], ['近 5 日最低價', recentLow5, '元'],
          ['前 5 日最低價', previousLow5, '元'], ['近 10 日振幅', range10 * 100, '%']
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
    A:'收盤價大於 MA60，且季線乖離（收盤價 ÷ MA60 − 1）不超過 12%。最近 5 日最低價高於再前 5 日最低價。近 10 日振幅（最高價 ÷ 最低價 − 1）小於 12%。近 5 日與近 10 日區間均包含當日。',
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

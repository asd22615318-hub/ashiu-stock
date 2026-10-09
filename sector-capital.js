/* Relative sector activity from the site's existing official market, institutional and TDCC snapshots. */
(() => {
  const originalRender = renderSectors;
  const signed = (value, digits = 1) => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
  const valid = value => Number.isFinite(value);
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const cashValue = bar => valid(bar?.close) && valid(bar?.volume) ? bar.close * bar.volume / 100000 : 0; // 億元；volume is 張

  window.renderSectorFlow = function renderSectorFlow() {
    const root = $('sectors');
    if (!root || root.hidden) return;
    let panel = root.querySelector('#sector-capital');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'sector-capital';
      panel.className = 'sector-capital';
      root.querySelector('.sector-heading').after(panel);
    }
    if (mode !== 'live' || !records.length || !analyses.length) {
      panel.innerHTML = '<h2>資金與籌碼族群排名</h2><p>請先載入官方盤後行情。</p>';
      return;
    }
    if (!institutional?.report_dates?.length || !ownership?.weeks || ownership.weeks.length < 2) {
      panel.innerHTML = '<h2>資金與籌碼族群排名</h2><p>正在載入法人及集保週資料…</p>';
      return;
    }

    const marketDate = analyses.map(stock => stock.t.date).sort().at(-1);
    const latest = new Map(records.filter(stock => stock.bars.at(-1)?.date === marketDate).map(stock => [stock.code, stock]));
    const marketCash = [...latest.values()].reduce((sum, stock) => sum + cashValue(stock.bars.at(-1)), 0);
    const prior = ownership.weeks.at(-2), current = ownership.weeks.at(-1);
    const themes = new Map();
    for (const group of STOCK_GROUPS) {
      if (group.theme === '自訂族群') continue;
      if (!themes.has(group.theme)) themes.set(group.theme, new Set());
      group.codes.forEach(code => themes.get(group.theme).add(code));
    }
    const rows = [...themes].map(([theme, codes]) => {
      const members = [...codes].map(code => latest.get(code)).filter(Boolean);
      const cash = members.reduce((sum, stock) => sum + cashValue(stock.bars.at(-1)), 0);
      const comparable = members.filter(stock => stock.bars.length >= 6 && stock.bars.slice(-6).every(bar => cashValue(bar) > 0));
      const todayComparable = comparable.reduce((sum, stock) => sum + cashValue(stock.bars.at(-1)), 0);
      const priorAverage = comparable.reduce((sum, stock) => sum + average(stock.bars.slice(-6, -1).map(cashValue)), 0);
      const flows = members.map(stock => institutionalFlow(stock.code)).filter(Boolean);
      const flowNet = flows.reduce((sum, flow) => sum + flow.net, 0);
      const flowVolume = flows.reduce((sum, flow) => sum + flow.volume, 0);
      const deltas = members.map(stock => {
        const now = current.stocks?.[stock.code]?.['400'], before = prior.stocks?.[stock.code]?.['400'];
        return valid(now) && valid(before) ? now - before : null;
      }).filter(valid);
      return {
        theme: theme.replace(' 印刷電路板產業', '').replace(/產業$/, ''),
        cash, cashShare: marketCash > 0 ? cash / marketCash * 100 : null,
        cashRatio: priorAverage > 0 ? todayComparable / priorAverage : null,
        instRatio: flowVolume > 0 ? flowNet / flowVolume * 100 : null,
        tdccDelta: deltas.length ? average(deltas) : null,
        count: members.length, instCount: flows.length, tdccCount: deltas.length
      };
    });
    const eligible = rows.filter(row => row.count >= 3 && row.instCount >= 3 && row.tdccCount >= 3 &&
      [row.cashShare, row.cashRatio, row.instRatio, row.tdccDelta].every(valid));
    for (const key of ['cashShare', 'cashRatio', 'instRatio', 'tdccDelta']) {
      const sorted = [...eligible].sort((a, b) => b[key] - a[key]);
      sorted.forEach((row, index) => { row[key + 'Rank'] = sorted.length === 1 ? 100 : (sorted.length - index - 1) / (sorted.length - 1) * 100; });
    }
    eligible.forEach(row => { row.score = average(['cashShare', 'cashRatio', 'instRatio', 'tdccDelta'].map(key => row[key + 'Rank'])); });
    eligible.sort((a, b) => b.score - a.score || b.cashShare - a.cashShare);
    panel.innerHTML = `<div class="sector-capital-head"><div><h2>資金與籌碼族群排名</h2><p>盤後資料：成交值 ${esc(marketDate)} · 法人截至 ${esc(institutional.report_dates[0])} · 集保 ${esc(prior.date)} → ${esc(current.date)}</p></div><small>${eligible.length} 個資料足夠的族群</small></div>
      <p class="sector-capital-note">綜合排名＝成交值占比、今日／前 5 日平均成交值、近 5 日法人淨買超占成交量、400 張以上持股比例週變化，四項族群名次百分位平均。成交值反映交易活躍度，不能解讀為資金淨流入；族群可重疊。</p>
      <div class="sector-capital-list">${eligible.map((row, index) => `<article class="sector-capital-row"><div class="sector-capital-title"><b>${index + 1}</b><strong>${esc(row.theme)}</strong><small>綜合 ${row.score.toFixed(0)} 分</small></div><div class="sector-capital-metrics"><span><small>今日成交值</small><strong>${fmt(row.cash, 1)} 億</strong></span><span><small>占市場成交值</small><strong>${fmt(row.cashShare, 1)}%</strong></span><span><small>成交值／前 5 日</small><strong>${fmt(row.cashRatio, 2)} 倍</strong></span><span><small>法人近 5 日</small><strong class="${row.instRatio >= 0 ? 'positive' : 'negative'}">${signed(row.instRatio, 2)}%</strong></span><span><small>大戶持股週變化</small><strong class="${row.tdccDelta >= 0 ? 'positive' : 'negative'}">${signed(row.tdccDelta, 2)} 百分點</strong></span></div><p>有效檔數：成交值 ${row.count}、法人 ${row.instCount}、集保 ${row.tdccCount}</p></article>`).join('') || '<p>目前沒有資料完整的族群可排名。</p>'}</div>
      <p class="sector-capital-source">來源：<a href="https://www.twse.com.tw/zh/trading/foreign/t86.html" target="_blank" rel="noopener">證交所三大法人</a>、<a href="https://original-www.tdcc.com.tw/portal/zh/smWeb/qryStock" target="_blank" rel="noopener">集保戶股權分散表</a>；行情為本站載入的證交所及櫃買中心盤後資料。</p>`;
  };
  renderSectors = function () { originalRender(); window.renderSectorFlow(); };
})();


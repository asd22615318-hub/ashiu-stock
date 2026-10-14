/* Relative sector activity from the site's existing official market, institutional and TDCC snapshots. */
(() => {
  const originalRender = renderSectors;
  let dailyRankingOpen = true;
  const signed = (value, digits = 1) => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
  const valid = value => Number.isFinite(value);
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;

  function renderDailyStrength(root) {
    let panel = root.querySelector('#sector-daily-strength');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'sector-daily-strength';
      panel.className = 'sector-capital sector-daily-strength';
      root.querySelector('.sector-heading').after(panel);
    }
    if (mode !== 'live' || !records.length) {
      panel.innerHTML = '<h2>每日強勢族群排名</h2><p>請先載入官方盤後行情。</p>';
      return;
    }
    const marketDate = records.map(stock => stock.bars.at(-1)?.date).filter(Boolean).sort().at(-1);
    const stocks = new Map(records.filter(stock => stock.bars.at(-1)?.date === marketDate).map(stock => [stock.code, stock]));
    const themes = new Map();
    for (const group of STOCK_GROUPS) {
      if (group.theme === '自訂族群') continue;
      if (!themes.has(group.theme)) themes.set(group.theme, new Set());
      group.codes.forEach(code => themes.get(group.theme).add(code));
    }
    const rows = [...themes].map(([theme, codes]) => {
      const members = [...codes].map(code => stocks.get(code)).filter(stock => {
        const bars = stock?.bars;
        return bars?.length >= 2 && valid(bars.at(-1).close) && valid(bars.at(-2).close) && bars.at(-2).close > 0;
      });
      const changes = members.map(stock => (stock.bars.at(-1).close / stock.bars.at(-2).close - 1) * 100);
      const volumeMembers = members.filter(stock => stock.bars.length >= 6 && stock.bars.slice(-6).every(bar => valid(bar.volume) && bar.volume > 0));
      const priorVolume = volumeMembers.reduce((sum, stock) => sum + average(stock.bars.slice(-6, -1).map(bar => bar.volume)), 0);
      const volumeRatio = priorVolume > 0 ? volumeMembers.reduce((sum, stock) => sum + stock.bars.at(-1).volume, 0) / priorVolume : null;
      return {
        theme: theme.replace(' 印刷電路板產業', '').replace(/產業$/, ''),
        count: members.length,
        change: changes.length ? average(changes) : null,
        breadth: changes.length ? changes.filter(change => change > 0).length / changes.length * 100 : null,
        volumeRatio,
        leaders: members.map((stock, index) => ({stock, change: changes[index]})).sort((a, b) => b.change - a.change).slice(0, 3)
      };
    }).filter(row => row.count >= 3 && valid(row.volumeRatio));
    for (const key of ['change', 'breadth', 'volumeRatio']) {
      const sorted = [...rows].sort((a, b) => b[key] - a[key]);
      sorted.forEach((row, index) => { row[key + 'Rank'] = sorted.length === 1 ? 100 : (sorted.length - index - 1) / (sorted.length - 1) * 100; });
    }
    rows.forEach(row => { row.score = row.changeRank * .5 + row.breadthRank * .3 + row.volumeRatioRank * .2; });
    rows.sort((a, b) => b.score - a.score || b.change - a.change);
    panel.innerHTML = `<details class="sector-capital-details" ${dailyRankingOpen ? 'open' : ''}><summary class="sector-capital-head"><div><h2>每日強勢族群排名</h2><p>行情日期 ${esc(marketDate)} · ${rows.length} 個可比較族群</p></div><small>當日強弱</small></summary><p class="sector-capital-note">依族群成員等權平均漲幅 50%、上漲家數比例 30%、今日成交量／前 5 日均量 20% 的名次百分位排序。至少 3 檔有當日及前日價格才列入；族群成員可能重疊。</p><div class="sector-capital-list">${rows.slice(0, 10).map((row, index) => `<article class="sector-capital-row"><div class="sector-capital-title"><b>${index + 1}</b><strong>${esc(row.theme)}</strong><small>強度 ${row.score.toFixed(0)} 分</small></div><div class="sector-capital-metrics sector-daily-metrics"><span><small>平均漲幅</small><strong class="${row.change >= 0 ? 'positive' : 'negative'}">${signed(row.change, 2)}%</strong></span><span><small>上漲比例</small><strong>${fmt(row.breadth, 0)}%</strong></span><span><small>量／前 5 日</small><strong>${fmt(row.volumeRatio, 2)} 倍</strong></span><span><small>有效個股</small><strong>${row.count} 檔</strong></span></div><p>領漲：${row.leaders.map(({stock, change}) => `${esc(stock.name || stock.code)} ${signed(change, 1)}%`).join(' · ')}</p></article>`).join('') || '<p>目前沒有足夠的當日行情可排名。</p>'}</div></details>`;
    panel.querySelector('.sector-capital-details').addEventListener('toggle', event => { dailyRankingOpen = event.target.open; });
  }

  window.renderSectorFlow = function renderSectorFlow() {
    const root = $("sectors");
    if (!root || root.hidden) return;
    renderDailyStrength(root);
  };
  renderSectors = function () { originalRender(); window.renderSectorFlow(); };
})();


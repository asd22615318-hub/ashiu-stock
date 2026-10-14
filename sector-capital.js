/* Relative sector activity from the site's existing official market, institutional and TDCC snapshots. */
(() => {
  const originalRender = renderSectors;
  let rankingOpen = true;
  const signed = (value, digits = 1) => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
  const valid = value => Number.isFinite(value);
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const cashValue = bar => valid(bar?.amount) ? bar.amount / 100000000 : valid(bar?.close) && valid(bar?.volume) ? bar.close * bar.volume / 100000 : 0; // 億元；volume is 張

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
      const dailyReturns = members.map(stock => {
        const bars = stock.bars;
        if (bars.length < 2) return null;
        const prev = bars.at(-2).close, now = bars.at(-1).close;
        return prev > 0 ? (now / prev - 1) * 100 : null;
      }).filter(valid);
      const breadth = dailyReturns.length ? dailyReturns.filter(x => x > 0).length / dailyReturns.length * 100 : null;
      const avgReturn = dailyReturns.length ? average(dailyReturns) : null;
      const deltas = members.map(stock => {
        const now = current.stocks?.[stock.code]?.['400'], before = prior.stocks?.[stock.code]?.['400'];
        return valid(now) && valid(before) ? now - before : null;
      }).filter(valid);
      return {
        theme: theme.replace(' 印刷電路板產業', '').replace(/產業$/, ''),
        cash, breadth, avgReturn, cashShare: marketCash > 0 ? cash / marketCash * 100 : null,
        cashRatio: priorAverage > 0 ? todayComparable / priorAverage : null,
        instRatio: flowVolume > 0 ? flowNet / flowVolume * 100 : null,
        tdccDelta: deltas.length ? average(deltas) : null,
        count: members.length, instCount: flows.length, tdccCount: deltas.length
      };
    });
    // Two independent tracks: price/volume and disclosed institutional/TDCC holdings.
    // Missing coverage stays null rather than silently becoming zero.
    const rankMetric = (items, key) => {
      const ordered = items.filter(r => valid(r[key])).sort((a,b) => a[key]-b[key]);
      ordered.forEach((r,i) => { r[key+'Score'] = ordered.length === 1 ? 50 : i/(ordered.length-1)*100; });
    };
    const eligible = rows.filter(r => r.count >= 3 && valid(r.cashRatio) && valid(r.breadth) && valid(r.avgReturn));
    ['cashRatio','breadth','avgReturn','instRatio','tdccDelta'].forEach(key => rankMetric(eligible,key));
    eligible.forEach(r => {
      r.priceScore = .35*r.cashRatioScore + .30*r.avgReturnScore + .35*r.breadthScore;
      const chipParts = [[r.instRatioScore,.65],[r.tdccDeltaScore,.35]].filter(([v]) => valid(v));
      r.chipScore = chipParts.length ? chipParts.reduce((sum,[v,w])=>sum+v*w,0)/chipParts.reduce((sum,[v,w])=>sum+w,0) : null;
      r.score = valid(r.chipScore) ? .6*r.priceScore + .4*r.chipScore : null;
      r.coverage = (r.instCount >= 3 ? '法人' : '') + (r.tdccCount >= 3 ? ' 集保' : '');
    });
    eligible.sort((a,b) => (b.score ?? -1)-(a.score ?? -1) || b.priceScore-a.priceScore);
    panel.innerHTML = `<details class="sector-capital-details" ${rankingOpen ? 'open' : ''}><summary class="sector-capital-head"><div><h2>資金與籌碼族群排名</h2><p>盤後資料：成交值 ${esc(marketDate)} · 法人截至 ${esc(institutional.report_dates[0])} · 集保 ${esc(prior.date)} → ${esc(current.date)}</p></div><small>${eligible.length} 個資料足夠的族群</small></summary>
      <p class="sector-capital-note">雙軌排名：量價＝相對成交值35%＋等權平均漲幅30%＋上漲家數比35%；籌碼＝法人淨買超65%＋集保400張以上持股率變化35%（僅就可用指標重新加權）。綜合＝量價60%＋籌碼40%；缺籌碼時不給綜合分數。成交值反映交易活躍度，不能解讀為資金淨流入；族群可重疊。</p>
      <div class="sector-capital-list">${eligible.map((row, index) => `<article class="sector-capital-row"><div class="sector-capital-title"><b>${index + 1}</b><strong>${esc(row.theme)}</strong><small>量價 ${row.priceScore.toFixed(0)}／籌碼 ${row.chipScore == null ? '資料不足' : row.chipScore.toFixed(0)}／綜合 ${row.score == null ? '—' : row.score.toFixed(0)}</small></div><div class="sector-capital-metrics"><span><small>上漲占比</small><strong>${fmt(row.breadth, 1)}%</strong></span><span><small>等權漲幅</small><strong>${signed(row.avgReturn, 2)}%</strong></span><span><small>今日成交值</small><strong>${fmt(row.cash, 1)} 億</strong></span><span><small>占市場成交值</small><strong>${fmt(row.cashShare, 1)}%</strong></span><span><small>成交值／前 5 日</small><strong>${fmt(row.cashRatio, 2)} 倍</strong></span><span><small>法人近 5 日</small><strong class="${row.instRatio >= 0 ? 'positive' : 'negative'}">${signed(row.instRatio, 2)}%</strong></span><span><small>大戶持股週變化</small><strong class="${row.tdccDelta >= 0 ? 'positive' : 'negative'}">${signed(row.tdccDelta, 2)} 百分點</strong></span></div><p>有效檔數：成交值 ${row.count}、法人 ${row.instCount}、集保 ${row.tdccCount}</p></article>`).join('') || '<p>目前沒有資料完整的族群可排名。</p>'}</div>
      <p class="sector-capital-source">來源：<a href="https://www.twse.com.tw/zh/trading/foreign/t86.html" target="_blank" rel="noopener">證交所三大法人</a>、<a href="https://original-www.tdcc.com.tw/portal/zh/smWeb/qryStock" target="_blank" rel="noopener">集保戶股權分散表</a>；行情為本站載入的證交所及櫃買中心盤後資料。</p></details>`;
    panel.querySelector('.sector-capital-details').addEventListener('toggle', event => { rankingOpen = event.target.open; });
  };
  renderSectors = function () { originalRender(); window.renderSectorFlow(); };
})();


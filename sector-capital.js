/* Sector activity from official market, institutional and TDCC snapshots. */
(() => {
  let rankingOpen = true;
  const valid = Number.isFinite;
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const signed = (value, digits = 1) => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
  const cashValue = bar => valid(bar?.amount) && bar.amount > 0
    ? bar.amount / 1e8
    : valid(bar?.close) && valid(bar?.volume) ? bar.close * bar.volume / 100000 : 0; // 億元；volume is 張

  window.renderSectorFlow = function renderSectorFlow() {
    const root = $('sectors');
    if (!root || root.hidden) return;
    const panel = root.querySelector('#sector-capital');
    if (!panel) return;
    if (mode !== 'live' || !records.length || !analyses.length) {
      panel.innerHTML = '<h2>資金強度前 10 名族群</h2><p>請先載入官方盤後行情。</p>';
      return;
    }
    if (!institutional?.report_dates?.length || !ownership?.weeks || ownership.weeks.length < 2) {
      panel.innerHTML = '<h2>資金強度前 10 名族群</h2><p>正在載入法人及集保週資料…</p>';
      return;
    }

    const marketDate = analyses.map(stock => stock.t.date).sort().at(-1);
    const latest = new Map(analyses.filter(stock => stock.t.date === marketDate).map(stock => [stock.code, stock]));
    const marketCash = [...latest.values()].reduce((sum, stock) => sum + cashValue(stock.t), 0);
    const prior = ownership.weeks.at(-2), current = ownership.weeks.at(-1);
    const themes = new Map();
    for (const group of STOCK_GROUPS) {
      if (group.theme === '自訂族群') continue;
      if (!themes.has(group.theme)) themes.set(group.theme, new Set());
      group.codes.forEach(code => themes.get(group.theme).add(code));
    }
    const rows = [...themes].map(([theme, codes]) => {
      const members = [...codes].map(code => latest.get(code)).filter(Boolean);
      const cash = members.reduce((sum, stock) => sum + cashValue(stock.t), 0);
      const comparable = members.filter(stock => stock.bars.length >= 6 && stock.bars.slice(-6).every(bar => cashValue(bar) > 0));
      const todayComparable = comparable.reduce((sum, stock) => sum + cashValue(stock.t), 0);
      const priorAverage = comparable.reduce((sum, stock) => sum + average(stock.bars.slice(-6, -1).map(cashValue)), 0);
      const flows = members.map(stock => institutionalFlow(stock.code)).filter(Boolean);
      const flowNet = flows.reduce((sum, flow) => sum + flow.net, 0);
      const flowVolume = flows.reduce((sum, flow) => sum + flow.volume, 0);
      const deltas = members.map(stock => {
        const now = current.stocks?.[stock.code]?.['400'], before = prior.stocks?.[stock.code]?.['400'];
        return valid(now) && valid(before) ? now - before : null;
      }).filter(valid);
      const maMembers = members.filter(stock => valid(stock.m20) && stock.m20 > 0 && valid(stock.t.close));
      const aboveMa20 = maMembers.filter(stock => stock.t.close >= stock.m20).length;
      return {
        theme: theme.replace(' 印刷電路板產業', '').replace(/產業$/, ''),
        members: members.sort((a, b) => a.code.localeCompare(b.code)),
        cash, cashShare: marketCash > 0 ? cash / marketCash * 100 : null,
        cashRatio: priorAverage > 0 ? todayComparable / priorAverage : null,
        instRatio: flowVolume > 0 ? flowNet / flowVolume * 100 : null,
        tdccDelta: deltas.length ? average(deltas) : null,
        count: members.length, instCount: flows.length, tdccCount: deltas.length,
        aboveMa20, maCount: maMembers.length,
        maRatio: maMembers.length ? aboveMa20 / maMembers.length * 100 : null
      };
    });
    const eligible = rows.filter(row => row.count >= 3 && row.instCount >= 3 && row.tdccCount >= 3 &&
      [row.cashShare, row.cashRatio, row.instRatio, row.tdccDelta].every(valid));
    for (const key of ['cashShare', 'cashRatio', 'instRatio', 'tdccDelta']) {
      const sorted = [...eligible].sort((a, b) => b[key] - a[key]);
      sorted.forEach((row, index) => {
        row[key + 'Rank'] = sorted.length === 1 ? 100 : (sorted.length - index - 1) / (sorted.length - 1) * 100;
      });
    }
    eligible.forEach(row => { row.score = average(['cashShare', 'cashRatio', 'instRatio', 'tdccDelta'].map(key => row[key + 'Rank'])); });
    eligible.sort((a, b) => b.score - a.score || b.cashShare - a.cashShare);
    const topTen = eligible.slice(0, 10).map((row, index) => ({...row, capitalRank: index + 1}));
    topTen.sort((a, b) => (b.maRatio ?? -1) - (a.maRatio ?? -1) || b.score - a.score);

    panel.innerHTML = `<details class="sector-capital-details" ${rankingOpen ? 'open' : ''}><summary class="sector-capital-head"><div><h2>資金強度前 10 名族群</h2><p>盤後 ${esc(marketDate)} · 法人截至 ${esc(institutional.report_dates[0])} · 集保 ${esc(prior.date)} → ${esc(current.date)}</p></div><small>依站上 20MA 比例由高到低</small></summary>
      <p class="sector-capital-note">先按資金強度選出前 10 名，再依族群站上 20MA 比例排序；比例相同依資金強度排序。比例分母只計入當日有行情且可算出 20 日均線的成員股。資金強度綜合成交值占比、今日／前 5 日平均成交值、近 5 日法人淨買超占成交量、400 張以上持股比例週變化四項排名。成交值代表交易活躍度，族群可重疊。</p>
      <div class="sector-capital-list">${topTen.map((row, index) => `<article class="sector-capital-row"><div class="sector-capital-title"><b>${index + 1}</b><strong>${esc(row.theme)}</strong><small>資金強度第 ${row.capitalRank} 名 · ${row.score.toFixed(0)} 分</small></div>
        <div class="sector-capital-ma"><span>站上 20MA</span><strong>${row.maRatio == null ? '資料不足' : row.maRatio.toFixed(1) + '%'}</strong><small>${row.aboveMa20} / ${row.maCount} 檔</small></div>
        <div class="sector-capital-bar" role="img" aria-label="站上 20MA 比例 ${row.maRatio == null ? '資料不足' : row.maRatio.toFixed(1) + '%'}"><span style="width:${row.maRatio ?? 0}%"></span></div>
        <div class="sector-capital-metrics"><span><small>今日成交值</small><strong>${fmt(row.cash, 1)} 億</strong></span><span><small>占市場成交值</small><strong>${fmt(row.cashShare, 1)}%</strong></span><span><small>成交值／前 5 日</small><strong>${fmt(row.cashRatio, 2)} 倍</strong></span><span><small>法人近 5 日</small><strong class="${row.instRatio >= 0 ? 'positive' : 'negative'}">${signed(row.instRatio, 2)}%</strong></span><span><small>大戶持股週變化</small><strong class="${row.tdccDelta >= 0 ? 'positive' : 'negative'}">${signed(row.tdccDelta, 2)} 百分點</strong></span></div>
        <div class="sector-capital-members"><h3>相關個股 <small>${row.members.length} 檔</small></h3><div class="sector-capital-stocks">${row.members.map(stock => `<button type="button" class="sector-capital-stock ${valid(stock.m20) && stock.m20 > 0 ? stock.t.close >= stock.m20 ? 'above' : 'below' : 'unknown'}" data-code="${esc(stock.code)}"><strong>${esc(stock.name)} <small>${esc(stock.code)}</small></strong><span>${valid(stock.m20) && stock.m20 > 0 ? stock.t.close >= stock.m20 ? '站上 20MA' : '未站上 20MA' : '20MA 待補'}</span></button>`).join('')}</div></div>
        <p>有效檔數：當日行情 ${row.count}、法人 ${row.instCount}、集保 ${row.tdccCount}</p></article>`).join('') || '<p>目前沒有資料完整的族群可排名。</p>'}</div>
      <p class="sector-capital-source">來源：<a href="https://www.twse.com.tw/zh/trading/foreign/t86.html" target="_blank" rel="noopener">證交所三大法人</a>、<a href="https://original-www.tdcc.com.tw/portal/zh/smWeb/qryStock" target="_blank" rel="noopener">集保戶股權分散表</a>；行情為本站載入的證交所及櫃買中心盤後資料。</p></details>`;
    panel.querySelector('.sector-capital-details').addEventListener('toggle', event => { rankingOpen = event.target.open; });
    panel.querySelectorAll('.sector-capital-stock').forEach(button => button.addEventListener('click', () => {
      const stock = latest.get(button.dataset.code);
      if (stock) openStockDetail(stock, button);
    }));
  };
  renderSectors = function () {
    const root = $('sectors');
    root.innerHTML = '<div class="sector-heading"><h1>族群輪動雷達</h1><p>資金強度前 10 名族群 · 站上 20MA 比例由高到低</p></div><section id="sector-capital" class="sector-capital"></section>';
    window.renderSectorFlow();
  };
})();


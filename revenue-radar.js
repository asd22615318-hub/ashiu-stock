/* Official monthly revenue, grouped by the site's existing stock taxonomy. */
(() => {
  let report = null;
  let error = '';
  let positiveOnly = true;
  let market = 'all';
  let query = '';
  let leadersOpen = true;
  const percent = value => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const stockCard = stock => `<button class="revenue-stock" type="button" data-code="${esc(stock.code)}" ${stock.quote ? '' : 'disabled'}><span class="revenue-stock-name"><strong>${esc(stock.name)}</strong><small>${esc(stock.code)} · ${esc(stock.revenue.market)}</small></span><span class="revenue-stock-metric revenue-stock-score"><small>均線分數</small><b>${stock.quote?.score == null ? '待補' : `${stock.quote.score}/15`}</b></span><span class="revenue-stock-metric revenue-stock-yoy"><small>年增</small><b>${percent(stock.revenue.yoy)}</b></span><span class="revenue-stock-metric revenue-stock-mom"><small>月增</small><b>${percent(stock.revenue.mom)}</b></span><span class="revenue-stock-metric"><small>累計年增</small><b class="${stock.revenue.ytd_yoy >= 0 ? 'up' : 'down'}">${percent(stock.revenue.ytd_yoy)}</b></span></button>`;
  const searchCard = stock => `<article class="revenue-stock revenue-search-card"><span class="revenue-stock-name">${stock.quote ? `<button type="button" class="revenue-stock-open" data-code="${esc(stock.code)}">${esc(stock.name)} ↗</button>` : `<strong>${esc(stock.name)}</strong>`}<small>${esc(stock.code)} · ${esc(stock.revenue.market)}${stock.quote ? ' · 點名稱看完整個股資訊' : ' · 暫無日線個股資訊'}</small></span><span class="revenue-stock-metric revenue-stock-score"><small>均線分數</small><b>${stock.quote?.score == null ? '待補' : `${stock.quote.score}/15`}</b></span><span class="revenue-stock-metric revenue-stock-yoy"><small>年增</small><b>${percent(stock.revenue.yoy)}</b></span><span class="revenue-stock-metric revenue-stock-mom"><small>月增</small><b>${percent(stock.revenue.mom)}</b></span><span class="revenue-stock-metric"><small>累計年增</small><b>${percent(stock.revenue.ytd_yoy)}</b></span></article>`;

  window.renderRevenue = function renderRevenueRadar() {
    const root = $('revenue');
    if (!root) return;
    const groups = window.getHotSectorGroups?.() || new Map();
    const stockIndex = new Map(analyses.map(stock => [stock.code, stock]));
    const sectors = [...groups].map(([name, codes]) => {
      const members = [...codes].map(code => {
        const quote = stockIndex.get(code);
        const revenue = report?.stocks?.[code];
        return { code, name: quote?.name || revenue?.name || code, quote, revenue };
      }).filter(stock => stock.revenue && (market === 'all' || stock.revenue.market === market));
      const values = members.map(stock => stock.revenue.yoy);
      const monthlyValues = members.map(stock => stock.revenue.mom).filter(value => value != null);
      const positive = values.filter(value => value > 0).length;
      return { name, members, coverage: members.length, total: codes.size,
        avg: values.length ? average(values) : null,
        avgMom: monthlyValues.length ? average(monthlyValues) : null,
        positiveShare: values.length ? positive / values.length * 100 : null };
    }).sort((a, b) => (b.avg ?? -Infinity) - (a.avg ?? -Infinity));
    const term = query.trim().toLowerCase();
    const matchingStocks = term && report ? Object.entries(report.stocks)
      .filter(([code, revenue]) => `${code} ${revenue.name}`.toLowerCase().includes(term))
      .map(([code, revenue]) => ({ code, name: revenue.name || stockIndex.get(code)?.name || code, revenue, quote: stockIndex.get(code) }))
      .sort((a, b) => a.code.localeCompare(b.code, 'zh-Hant')) : [];
    const visible = sectors.filter(sector => !term || sector.name.toLowerCase().includes(term)
      || sector.members.some(stock => `${stock.name} ${stock.code}`.toLowerCase().includes(term)));
    const ranked = sectors.filter(sector => sector.coverage >= 3).slice(0, 5);
    root.innerHTML = `<div class="sector-heading"><h1>營收成長雷達</h1><p>最新官方月報 ${esc(report?.month || '載入中')} · 沿用族群輪動雷達的細分族群 · 按成員平均年增率排序</p></div>
      <div class="revenue-note">${report ? `涵蓋 ${Object.keys(report.stocks).length} 檔上市、上櫃公司；比較同一資料月份。族群平均採有公布成員的簡單平均，同一族群內的個股代號只計一次；同股可屬於不同主題。` : esc(error || '正在讀取官方月營收…')}</div>
      ${report ? `<details class="revenue-leaders" ${leadersOpen ? 'open' : ''}><summary>營收成長前五名族群 <small>依平均年增率排序</small></summary><div class="revenue-leader-grid">${ranked.map((sector, rank) => `<div><small>第 ${rank + 1} 名</small><strong>${esc(sector.name)}</strong><span>平均年增 <b>${percent(sector.avg)}</b></span><span>平均月增 <b>${percent(sector.avgMom)}</b></span><span>${sector.coverage} 家公布 · ${sector.positiveShare.toFixed(0)}% 年增為正</span></div>`).join('')}</div></details>` : ''}
      <div class="revenue-toolbar"><button type="button" id="revenue-positive" class="${positiveOnly ? 'active' : ''}">${positiveOnly ? '只看年增為正' : '顯示全部已公布'}</button><label>市場 <select id="revenue-market"><option value="all">上市＋上櫃</option><option value="上市">上市</option><option value="上櫃">上櫃</option></select></label><form id="revenue-search-form" class="revenue-search-form"><label for="revenue-search">搜尋</label><input id="revenue-search" type="search" placeholder="族群、股號或名稱" value="${esc(query)}"><button type="submit" id="revenue-search-confirm">確認</button></form></div>
      <dialog id="revenue-search-dialog" class="revenue-search-dialog" aria-labelledby="revenue-search-title"><div class="revenue-search-dialog-head"><div><h2 id="revenue-search-title">個股營收資訊</h2><p>官方月報 ${esc(report?.month || '—')} · ${matchingStocks.length} 筆結果</p></div><button type="button" id="revenue-search-close" aria-label="關閉營收資訊">× 返回</button></div><div class="revenue-members">${matchingStocks.length ? matchingStocks.map(searchCard).join('') : `<p>${report ? `目前官方月報沒有符合「${esc(query)}」的營收資料。` : '正在讀取官方月營收…'}</p>`}</div></dialog>
      ${visible.map((sector, index) => {
        const stocks = sector.members.filter(stock => !positiveOnly || stock.revenue.yoy > 0)
          .filter(stock => !term || sector.name.toLowerCase().includes(term) || `${stock.name} ${stock.code}`.toLowerCase().includes(term))
          .sort((a, b) => b.revenue.yoy - a.revenue.yoy);
        return `<details class="sector-theme revenue-theme" ${index < 2 || term ? 'open' : ''}><summary>${esc(sector.name)} <small>${sector.avg == null ? '尚無營收' : `平均年增 ${percent(sector.avg)} · 正成長 ${sector.positiveShare.toFixed(0)}% · ${sector.coverage}/${sector.total} 家公布`}</small></summary>
          <div class="revenue-members">${stocks.length ? stocks.map(stockCard).join('') : '<p>此條件下沒有已公布的成員。</p>'}</div></details>`;
      }).join('')}
      <p class="revenue-source">資料來源：<a href="https://data.gov.tw/dataset/18420" target="_blank" rel="noopener">上市月營收</a>、<a href="https://data.gov.tw/dataset/56510" target="_blank" rel="noopener">上櫃月營收</a>。月報更新時間可能晚於個別公司的公告，未公布或缺漏不當作零。</p>`;
    root.querySelector('#revenue-positive').onclick = () => { positiveOnly = !positiveOnly; renderRevenue(); };
    root.querySelector('.revenue-leaders')?.addEventListener('toggle', event => { leadersOpen = event.target.open; });
    root.querySelector('#revenue-market').value = market;
    root.querySelector('#revenue-market').onchange = event => { market = event.target.value; renderRevenue(); };
    root.querySelector('#revenue-search-form').onsubmit = event => {
      event.preventDefault();
      query = root.querySelector('#revenue-search').value.trim();
      renderRevenue();
      root.querySelector('#revenue-search-dialog').showModal();
    };
    root.querySelector('#revenue-search-close').onclick = () => root.querySelector('#revenue-search-dialog').close();
    root.querySelectorAll('.revenue-stock-open').forEach(button => button.onclick = () => {
      const stock = stockIndex.get(button.dataset.code);
      root.querySelector('#revenue-search-dialog').close();
      if (stock) openStockDetail(stock, root.querySelector('#revenue-search-confirm'));
    });
    root.querySelectorAll('.revenue-stock:not(:disabled)').forEach(button => button.onclick = () => {
      const stock = stockIndex.get(button.dataset.code);
      if (stock) openStockDetail(stock, button);
    });
  };

  fetch('revenue-data.json?v=' + Date.now(), { cache: 'no-store' })
    .then(response => { if (!response.ok) throw Error('營收快照尚未建立'); return response.json(); })
    .then(data => { if (!data.stocks || !data.month) throw Error('營收資料格式錯誤'); report = data; })
    .catch(cause => { error = `營收讀取失敗：${cause.message}`; })
    .finally(() => { if (!$('revenue').hidden) renderRevenue(); });
})();


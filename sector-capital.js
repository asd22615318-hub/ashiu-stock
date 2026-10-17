/* Relative sector activity from the site's existing official market, institutional and TDCC snapshots. */
(() => {
  let dailyRankingOpen = true, hotRankingOpen = true;
  const hotMemberOpen = new Set();
  function hotGroups() {
    const custom = name => STOCK_GROUPS.filter(g => g.theme === '自訂族群' && g.sub === name);
    const sub = (...names) => STOCK_GROUPS.filter(g => names.includes(g.sub));
    const codes = (...values) => [{codes:values}];
    const industry = name => [{codes:records.filter(s=>s.industry===name).map(s=>s.code)}];
    const definitions = [
      ['散熱', custom('散熱').concat(sub('液冷散熱','風扇散熱'))],
      ['航運', sub('貨櫃航運','散裝航運')],
      ['被動元件', custom('被動元件').concat(STOCK_GROUPS.filter(g => g.theme === '被動元件產業' && !g.sub.startsWith('上游材料') && !g.sub.startsWith('石英、'))) ],
      ['石英', custom('石英題材')],
      ['矽晶圓', STOCK_GROUPS.filter(g => g.theme === '半導體產業' && g.sub === '矽晶圓')],
      ['記憶體', custom('記憶體').concat(sub('DRAM 製造','DRAM 模組','NAND Flash 控制晶片','NOR Flash','記憶體 IC 設計','工業級記憶體'))],
      ['PCB 製板', sub('PCB 製板族群','AI 伺服器 PCB','高速網通 PCB','HDI 高密度板','FPC 軟板')],
      ['PCB 載板', sub('IC 載板族群','ABF 載板','BT 載板')],
      ['台塑四寶', sub('塑化四寶')],
      ['銅箔基板 CCL', sub('CCL 銅箔基板與高階材料')],
      ['玻纖布', custom('玻纖布')],
      ['AI 伺服器', sub('AI 伺服器 ODM','伺服器機殼／機櫃','伺服器滑軌')],
      ['矽光子／CPO', custom('矽光子CPO').concat(sub('CPO 共封裝光學','矽光子 PIC','光收發模組'))],
      ['重電', sub('重電／變壓器')],
      ['電池模組', custom('電池模組')],
      ['軍工', sub('航太軍工')],
      ['光學鏡頭', custom('光學鏡頭')],
      ['低軌衛星', custom('低軌衛星')],
      ['機器人／自動化', sub('機器人關節／減速機','工業自動化','機器視覺')],
      ['特用化學', custom('特化').concat(sub('特用化學','半導體特用材料'))],
      ['LED', custom('光通訊led').concat(sub('Mini LED／Micro LED','LED 封裝'))],
      ['玻璃基板', codes('3149','4768','3583')],
      ['資安', codes('6690','3029','6214','6811','6689')],
      ['FOPLP 扇出型封裝', custom('扇形封裝').concat(codes('3481','6239'))],
      ['CoWoS', sub('先進封裝 CoWoS')],
      ['功率半導體', custom('功率元件').concat(sub('功率半導體','第三代半導體 SiC／GaN'))],
      ['矽智財', custom('IP股').concat(sub('IP 矽智財'))],
      ['連接器', custom('連接器').concat(sub('高速連接器'))],
      ['觀光', industry('觀光餐旅')],
      ['紡織纖維', industry('紡織纖維')],
      ['金融', industry('金融保險業')],
      ['遊戲', codes('5478','6180','3083','3546','3293','6169','4994')],
      ['ASIC', sub('ASIC 客製化晶片')],
      ['鈣鈦礦', custom('鈣鈦礦')],
      ['紙類', industry('造紙工業')],
      ['工業電腦', sub('工業電腦').concat(codes('6166','6206','8234','6579'))],
      ['安全監控', custom('安全監控')],
      ['系統整合', custom('資訊')],
      ['面板', custom('面板').concat(sub('面板製造','面板驅動 IC'))],
      ['生技', industry('生技醫療業')]

    ];
    return new Map(definitions.map(([name,groups]) => [name,new Set(groups.flatMap(g => g.codes))]));
  }
  const signed = (value, digits = 1) => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
  const valid = value => Number.isFinite(value);
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;

  function renderDailyStrength(root, hot = false) {
    const panelId=hot?'sector-hot-strength':'sector-daily-strength', title=hot?'熱門細分族群排名':'每日強勢族群排名';
    let panel = root.querySelector('#'+panelId);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = panelId;
      panel.className = 'sector-capital sector-daily-strength';
      root.querySelector('.sector-heading').after(panel);
    }
    if (mode !== 'live' || !records.length) {
      panel.innerHTML = `<h2>${title}</h2><p>請先載入官方盤後行情。</p>`;
      return;
    }
    const marketDate = records.map(stock => stock.bars.at(-1)?.date).filter(Boolean).sort().at(-1);
    const stocks = new Map(records.filter(stock => stock.bars.at(-1)?.date === marketDate).map(stock => [stock.code, stock]));
    const themes = hot ? hotGroups() : new Map();
    for (const group of hot ? [] : STOCK_GROUPS) {
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
        total: codes.size,
        volumeCount: volumeMembers.length,
        members,
        maMembers: members.filter(s=>s.bars.length>=20 && s.bars.slice(-20).every(b=>valid(b.close)&&b.close>0)),
        change: changes.length ? average(changes) : null,
        breadth: changes.length ? changes.filter(change => change > 0).length / changes.length * 100 : null,
        volumeRatio,
        leaders: members.map((stock, index) => ({stock, change: changes[index]})).sort((a, b) => b.change - a.change).slice(0, 3)
      };
    }).filter(row => row.count >= 3 && valid(row.volumeRatio) && (!hot || row.volumeCount / row.count >= .8));
    for (const key of ['change', 'breadth', 'volumeRatio']) {
      const sorted = [...rows].sort((a, b) => b[key] - a[key]);
      sorted.forEach(row => { const first=sorted.findIndex(other=>other[key]===row[key]),last=sorted.findLastIndex(other=>other[key]===row[key]);row[key + 'Rank'] = sorted.length === 1 ? 100 : (sorted.length - (first+last)/2 - 1) / (sorted.length - 1) * 100; });
    }
    rows.forEach(row => { row.score = row.changeRank * .5 + row.breadthRank * .3 + row.volumeRatioRank * .2; });
    rows.sort((a, b) => b.score - a.score || b.change - a.change);
    panel.innerHTML = `<details class="sector-capital-details" ${(hot ? hotRankingOpen : dailyRankingOpen) ? 'open' : ''}><summary class="sector-capital-head"><div><h2>${title}</h2><p>行情日期 ${esc(marketDate)} · ${rows.length} 個可比較族群</p></div><small>當日強弱</small></summary><p class="sector-capital-note">依族群成員等權平均漲幅 50%、上漲家數比例 30%、今日成交量／前 5 日均量 20% 的名次百分位排序。至少 3 檔有當日及前日價格、且可計算量能才列入；族群成員可能重疊。${hot ? '熱門細分排名至少 80% 有效成員須具完整量能。本表為當日相對熱度，不代表全部族群都在上漲；石英另列，PCB 製板與載板分開比較。觀光、紡織、金融、紙類與生技採官方產業分類，其餘為主題及相關供應鏈名單；玻璃基板含材料與設備，資安含服務與通路，FOPLP 與 CoWoS 分開觀察。' : ''}</p><div class="sector-capital-list">${(hot ? rows : rows.slice(0, 10)).map((row, index) => `<article class="sector-capital-row"><div class="sector-capital-title"><b>${index + 1}</b><strong>${esc(row.theme)}</strong><small>強度 ${row.score.toFixed(0)} 分</small></div><div class="sector-capital-metrics sector-daily-metrics"><span><small>平均漲幅</small><strong class="${row.change >= 0 ? 'positive' : 'negative'}">${signed(row.change, 2)}%</strong></span><span><small>上漲比例</small><strong>${fmt(row.breadth, 0)}%</strong></span><span><small>量／前 5 日</small><strong>${fmt(row.volumeRatio, 2)} 倍</strong></span><span><small>有效個股</small><strong>${row.count}${hot ? ' / ' + row.total : ''} 檔</strong></span></div><p>領漲：${row.leaders.map(({stock, change}) => `${esc(stock.name || stock.code)} ${signed(change, 1)}%`).join(' · ')}</p>${hot ? hotMembersHtml(row) : ''}</article>`).join('') || '<p>目前沒有足夠的當日行情可排名。</p>'}</div></details>`;
    panel.querySelector('.sector-capital-details').addEventListener('toggle', event => { if(hot)hotRankingOpen=event.target.open;else dailyRankingOpen = event.target.open; });
  }

  function hotMembersHtml(row) {
    const eligible=row.maMembers, above=eligible.filter(s=>s.bars.at(-1).close>average(s.bars.slice(-20).map(b=>b.close))).length;
    return `<p>站上 20MA：${eligible.length ? fmt(above/eligible.length*100,0)+'%（'+above+'/'+eligible.length+' 檔）' : '歷史不足'} · 有效日線 ${eligible.length}/${row.count} 檔</p><details class="sector-subgroup" data-hot-group="${esc(row.theme)}" ${hotMemberOpen.has(row.theme)?'open':''}><summary>相關個股 · 展開查看 ${row.count} 檔</summary><div class="sector-members">${[...row.members].sort((a,b)=>(b.bars.at(-1).close/b.bars.at(-2).close)-(a.bars.at(-1).close/a.bars.at(-2).close)).map(s=>{const t=s.bars.at(-1),change=(t.close/s.bars.at(-2).close-1)*100;return `<div class="sector-member"><button type="button" class="sector-stock" data-hot-stock="${esc(s.code)}"><strong>${esc(s.name||s.code)}</strong><small>${esc(s.code)} · 收盤 ${fmt(t.close)}</small><span class="${change>=0?'up':'down'}">${signed(change,2)}%</span></button></div>`;}).join('')}</div></details>`;
  }

  window.renderSectorFlow = function renderSectorFlow() {
    const root = $("sectors");
    if (!root || root.hidden) return;
    renderDailyStrength(root,true);
    root.querySelectorAll('[data-hot-group]').forEach(el=>el.addEventListener('toggle',()=>{if(el.open)hotMemberOpen.add(el.dataset.hotGroup);else hotMemberOpen.delete(el.dataset.hotGroup);}));
    root.querySelectorAll('[data-hot-stock]').forEach(button=>button.addEventListener('click',()=>{const stock=analyses.find(s=>s.code===button.dataset.hotStock);if(stock)openStockDetail(stock,button);}));
  };
  renderSectors = function () {
    const root=$('sectors');
    root.innerHTML='<div class="sector-heading"><h1>族群輪動雷達</h1><p>依每日價量追蹤熱門細分族群，展開可查看相關個股。</p></div>';
    window.renderSectorFlow();
  };
})();


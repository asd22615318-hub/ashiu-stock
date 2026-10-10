/* Convertible-bond screening rules supplied by the site owner. */
(() => {
  const root = document.getElementById('convertible');
  if (!root) return;
  const rows = (items) => items.map(([name, rule]) => `<div class="cb-rule-row"><strong>${name}</strong><span>${rule}</span></div>`).join('');
  root.innerHTML = `
    <div class="sector-heading"><h1>可轉債雷達</h1><p>CB 領先正股 · 觀察可轉債量價與正股的連動</p></div>
    <div class="cb-data-status" id="cb-data-status" role="status"><strong>正在載入集保可轉債月資料…</strong><span>每日 CB 行情與有效轉換價尚未接入，以下策略分數暫不計算。</span></div>
    <section class="cb-panel" id="cb-data-panel" hidden><div class="cb-panel-heading"><div><span class="cb-kicker">官方資料</span><h2>可轉債保管月報</h2></div><small id="cb-data-period"></small></div><p class="cb-data-note">按本月底集保保管張數排序；月資料不代表今日成交量。發行張數為發行規模，並非剩餘流通張數。</p><label class="cb-search-label">搜尋代號或名稱 <input id="cb-data-search" type="search" placeholder="輸入可轉債或正股代號"></label><div class="cb-table-wrap"><table class="cb-table"><thead><tr><th>可轉債／正股</th><th>本月底保管</th><th>較前月</th><th>發行張數</th><th>集保戶數</th></tr></thead><tbody id="cb-data-rows"></tbody></table></div><p class="cb-data-note">資料來源：<a href="https://data.gov.tw/dataset/11462" target="_blank" rel="noopener">集保結算所可轉換公司債月分析表</a>。缺值以「—」表示。</p></section>
    <section class="cb-panel"><div class="cb-panel-heading"><div><span class="cb-kicker">候選條件</span><h2>CB 領先正股</h2></div><small>研究用初版門檻</small></div>
      <div class="cb-rule-grid">${rows([
        ['CB 20 日量比', '今日成交量 ÷ 前 20 個交易日均量 ≥ 3 倍'],
        ['轉換溢價率', '≤ 5%；優先觀察 0～3%'],
        ['正股／轉換價', '正股收盤價 ÷ 當日有效轉換價介於 95%～110%'],
        ['CB 近 3 日漲幅', '高於正股近 3 日漲幅'],
        ['正股技術型態', '收盤站上 5 日線，且尚未突破前 20 日高點'],
        ['觀察期間', '未來 5 個交易日；屬觀察窗口，非漲幅預測']
      ])}</div>
    </section>
    <div class="cb-two-col">
      <section class="cb-panel"><div class="cb-panel-heading"><div><span class="cb-kicker">量價條件</span><h2>放量與轉換位置</h2></div></div>
        <div class="cb-rule-grid">${rows([
          ['CB 異常放量', '今日量 ÷ 前 20 日均量 ≥ 3 倍'],
          ['CB 連續放量', '近 3 日總量 ÷ 前 3 日總量 ≥ 2 倍'],
          ['轉換溢價率', '0～5%，優先 0～3%'],
          ['轉換價距離', '正股收盤相對有效轉換價在 −10%～+3%'],
          ['正股型態', '站上 5 日線、量縮整理'],
          ['籌碼動向', '外資、投信或主力近 5 日偏多；有資料時才判定']
        ])}</div>
      </section>
      <section class="cb-panel"><div class="cb-panel-heading"><div><span class="cb-kicker">100 分模型</span><h2>CB 領先正股評分</h2></div><small>需先完成歷史驗證</small></div>
        <div class="cb-score-list">${[
          ['CB 異常放量倍數',20],['CB 近 3 日持續量增',15],['CB 價格相對正股強弱',20],['轉換溢價率與轉換價位置',15],['CB 剩餘流通張數及轉換變化',10],['正股技術面與籌碼',20]
        ].map(([label,score])=>`<div><span>${label}</span><b>${score} 分</b></div>`).join('')}<div class="cb-score-total"><strong>總分</strong><strong>100 分</strong></div></div>
      </section>
    </div>
    <div class="cb-two-col">
      <section class="cb-panel cb-strategy"><div class="cb-panel-heading"><div><span class="cb-kicker">策略 A</span><h2>CB 先放量，正股未突破</h2></div></div><p>優先回測的觀察組合：</p><ul>
        <li>CB 當日量 ≥ 前 20 日均量 3 倍，並排除基期成交量極低的個案。</li>
        <li>CB 近 3 日報酬比正股近 3 日報酬高 2 個百分點以上。</li>
        <li>正股近 5 日漲幅低於 5%，收盤尚未突破前 20 日高點。</li>
      </ul></section>
      <section class="cb-panel cb-strategy"><div class="cb-panel-heading"><div><span class="cb-kicker">策略 B</span><h2>正股接近轉換價，CB 放量</h2></div></div><ul>
        <li>CB 當日量 ≥ 前 20 日均量 2 倍。</li>
        <li>正股收盤價相對當日有效轉換價介於 −10%～+3%。</li>
        <li>CB 轉換溢價率介於 −2%～+5%。</li>
        <li>正股收盤站上 5 日均線。</li>
        <li>使用當時已公告生效的轉換價，不以事後最新價格回填歷史。</li>
      </ul></section>
    </div>
    <p class="cb-method-note">轉換溢價率以「CB 價格 ÷ 轉換價值 − 1」計算；轉換價值須按該債券面額與當日有效轉換價換算。上列門檻為使用者提供的研究方向，並非已驗證的預測結果。</p>`;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fmt = value => value == null ? '—' : Number(value).toLocaleString('zh-TW');
  const status = root.querySelector('#cb-data-status');
  const panel = root.querySelector('#cb-data-panel');
  fetch('convertible-data.json?v=' + Date.now(), {cache:'no-store'})
    .then(response => { if (!response.ok) throw Error('月資料尚未建立'); return response.json(); })
    .then(data => {
      if (!Array.isArray(data.bonds) || !data.bonds.length || !data.period) throw Error('月資料尚未取得');
      const bonds = [...data.bonds].sort((a,b) => (b.custody ?? -1) - (a.custody ?? -1) || a.code.localeCompare(b.code));
      status.innerHTML = `<strong>集保月報 ${esc(data.period)} · ${bonds.length} 檔可轉債</strong><span>已接入實際保管張數及月變化；每日 CB 價量與有效轉換價尚未接入，策略分數暫不計算。</span>`;
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
    .catch(error => { status.innerHTML = `<strong>集保可轉債月資料暫時無法顯示</strong><span>${esc(error.message)}；研究規則仍可查看，未產生任何推估排行。</span>`; });
})();


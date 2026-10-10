/* Convertible-bond screening rules supplied by the site owner. */
(() => {
  const root = document.getElementById('convertible');
  if (!root) return;
  const rows = (items) => items.map(([name, rule]) => `<div class="cb-rule-row"><strong>${name}</strong><span>${rule}</span></div>`).join('');
  root.innerHTML = `
    <div class="sector-heading"><h1>可轉債雷達</h1><p>CB 領先正股 · 觀察可轉債量價與正股的連動</p></div>
    <div class="cb-data-status" role="status"><strong>規則已建立，行情資料尚未接入</strong><span>目前展示篩選與評分口徑，尚無可轉債即時或盤後排行；不以正股成交量代替 CB 成交量。</span></div>
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
})();


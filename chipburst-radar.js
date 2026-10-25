(function () {
  'use strict';
  // A relative research score, not a sum of holdings and trading-flow percentages.
  function percentileScores(rows, key) {
    const sorted = [...rows].sort((a,b) => a[key]-b[key] || a.code.localeCompare(b.code));
    const scores = new Map();
    for (let start=0; start<sorted.length;) {
      let end=start+1;
      while (end<sorted.length && sorted[end][key]===sorted[start][key]) end++;
      const score=sorted.length===1 ? 50 : 100*(start+end-1)/2/(sorted.length-1);
      for (let i=start;i<end;i++) scores.set(sorted[i].code,score);
      start=end;
    }
    return scores;
  }
  function calculate(stocks, ownershipData, institutionalData, weekDate, brokerData) {
    const weeks=[...(ownershipData?.weeks || [])].sort((a,b)=>a.date.localeCompare(b.date));
    const index=weeks.findIndex(w=>w.date===weekDate), current=weeks[index], prior=weeks[index-1];
    if (!prior || !current) return {error:'需要選定週與前一週的集保資料。',rows:[]};
    const dates=[...new Set(stocks.flatMap(s=>s.bars.map(b=>b.date).filter(d=>d>prior.date&&d<=current.date)))].sort();
    if (!dates.length) return {error:'此集保區間的日線資料尚未補齊。',rows:[],prior,current,dates};
    const published=new Set(institutionalData?.report_dates || []);
    if (dates.some(d=>!published.has(d))) return {error:'此區間法人日報尚未齊全，請選其他週別或待資料更新。',rows:[],prior,current,dates};
    const universe=stocks.filter(s=>!['4155','6173'].includes(s.code)&&s.bars?.length && Number.isFinite(s.bars.at(-1).volume) && s.bars.at(-1).volume>500);
    const complete=[];
    for (const stock of universe) {
      const now=current.stocks?.[stock.code]?.['400'], old=prior.stocks?.[stock.code]?.['400'];
      if (current.invalid_stocks?.[stock.code]||prior.invalid_stocks?.[stock.code]||!Number.isFinite(now)||!Number.isFinite(old)||now<0||now>100||old<0||old>100) continue;
      const bars=new Map(stock.bars.map(b=>[b.date,b]));
      const history=new Map((institutionalData.stocks?.[stock.code]?.daily_history || []).filter(Boolean).map(h=>[h.date,h]));
      let volume=0,net=0,valid=true;
      for (const date of dates) {
        const bar=bars.get(date), h=history.get(date);
        if (!bar||!h||!Number.isFinite(bar.volume)||bar.volume<0||!Number.isFinite(h.total)) {valid=false;break;}
        volume+=bar.volume;net+=h.total;
      }
      if (!valid||volume<=0) continue;
      complete.push({code:stock.code,holderDelta:Math.round((now-old)*100)/100,holderNow:now,holderPrior:old,institutionalNet:net,institutionalRatio:net/volume*100,volume});
    }
    if (brokerData) {
      const period=brokerData.periods?.find(p=>p.end===dates.at(-1)&&p.start===dates[0]);
      if (!period||JSON.stringify(period.dates)!==JSON.stringify(dates)) return {error:'此週的分點區間尚未補齊，請選擇已提供的週別。',rows:[],prior,current,dates};
      const candidates=complete.filter(s=>s.holderDelta>0&&s.institutionalNet>0);
      const available=candidates.flatMap(s=>{
        const b=period.stocks?.[s.code];
        if (!b||b.start!==dates[0]||b.end!==dates.at(-1)||b.unit!=='lots'||b.top_n!==15||!Number.isFinite(b.buy_lots)||!Number.isFinite(b.sell_lots)||b.buy_lots<0||b.sell_lots<0||!Number.isFinite(b.net_lots)||Math.abs(b.net_lots-(b.buy_lots-b.sell_lots))>0.01||b.buyers?.length!==15||b.sellers?.length!==15) return [];
        return [{...s,brokerNet:b.net_lots,brokerBuy:b.buy_lots,brokerSell:b.sell_lots,brokerRatio:b.net_lots/s.volume*100,brokerSource:b.source}];
      });
      const hs=percentileScores(available,'holderDelta'),is=percentileScores(available,'institutionalRatio'),bs=percentileScores(available,'brokerRatio');
      const positive=available.filter(s=>s.brokerNet>0).map(s=>({...s,holderScore:hs.get(s.code),institutionScore:is.get(s.code),brokerScore:bs.get(s.code),score:hs.get(s.code)*0.4+is.get(s.code)*0.3+bs.get(s.code)*0.3}));
      positive.sort((a,b)=>b.score-a.score||b.holderDelta-a.holderDelta||a.code.localeCompare(b.code));
      return {rows:positive.slice(0,30),scoredRows:positive,eligible:positive.length,complete:available.length,universe:universe.length,candidates:candidates.length,excluded:candidates.length-available.length,prior,current,dates,threeFactor:true};
    }
    const holderScores=percentileScores(complete,'holderDelta'), institutionScores=percentileScores(complete,'institutionalRatio');
    const positive=complete.filter(s=>s.holderDelta>0&&s.institutionalNet>0).map(s=>({...s,score:(holderScores.get(s.code)+institutionScores.get(s.code))/2}));
    positive.sort((a,b)=>b.score-a.score||b.holderDelta-a.holderDelta||b.institutionalRatio-a.institutionalRatio||a.code.localeCompare(b.code));
    return {rows:positive.slice(0,30),eligible:positive.length,complete:complete.length,universe:universe.length,excluded:universe.length-complete.length,prior,current,dates};
  }
  if (typeof module!=='undefined'&&module.exports) module.exports={calculate,percentileScores};
  if (typeof window!=='undefined') window.chipburstModel={calculate,percentileScores};
  if (typeof document==='undefined'||typeof renderOwnership!=='function') return;
  const root=document.getElementById('chipburst-info');
  if (!root) return;
  const style=document.createElement('style');
  style.textContent=`.chipburst-info{background:#1d252c;border-color:#786440;color:#dce5e0}.chipburst-info h3{margin:0 0 10px}.chipburst-badge{display:inline-block;font-size:13px;padding:5px 10px;border:1px solid #9b7a42;border-radius:20px;color:#ffdc8c}.chipburst-table-wrap{overflow:auto;margin-top:15px}.chipburst-table{width:100%;min-width:930px;border-collapse:collapse;font-size:15px}.chipburst-table th,.chipburst-table td{padding:12px 10px;border-bottom:1px solid #40534b;text-align:right;vertical-align:middle;white-space:nowrap}.chipburst-table th{color:#d7c18d}.chipburst-table th:nth-child(2),.chipburst-table td:nth-child(2){text-align:left}.chipburst-table td small{display:block;font-size:12px;white-space:normal}.chipburst-table button{background:transparent;border:0;padding:0;text-align:left;cursor:pointer;color:#e8e7da;font:inherit}.chipburst-table button strong{display:block;color:#f2db9f;font-size:17px}.chipburst-table tr:hover{background:#263d33}.chipburst-score{font-size:22px;font-weight:800;color:#f4d081}.chipburst-buy{color:#ee9293}.chipburst-info .chipburst-period{color:#d0e4da}.chipburst-info .chipburst-detail-note{font-size:13px;color:#baccc2}.chipburst-info details{margin-top:12px}.chipburst-info summary{cursor:pointer;color:#e8cc89}.chipburst-info .chipburst-message{padding:12px;border:1px solid #605739;border-radius:10px;color:#e7d8b2}@media(max-width:680px){.chipburst-info{margin:0 12px 16px;padding:14px}.chipburst-table{font-size:14px}}`;
  document.head.appendChild(style);
  const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=(value,digits=2)=>Number.isFinite(value)?value.toLocaleString('zh-TW',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'—';
  const signed=value=>(value>0?'+':'')+number(value);
  let brokerData=null,brokerError='';
  function renderBurst() {
    if (ownershipMode!=='chipburst') return;
    root.innerHTML='<h3>籌碼暴增｜大戶＋分點＋法人</h3><span class="chipburst-badge">三項綜合籌碼分數 · 前 30 名</span><p class="chipburst-detail-note">集保 400 張以上大戶、前 15 大買賣超分點與三大法人採同一統計區間。分點是券商通路集中度，無法直接辨識大戶身分。</p>';
    const status=document.getElementById('ownership-status');
    if (mode!=='live'||!ownership||!institutional||!brokerData) {
      const message=mode!=='live'?'請先載入官方盤後行情。':brokerError|| (institutionalError?'法人資料讀取失敗，請重新載入行情頁。':'正在等候集保、分點與法人資料載入…');
      root.insertAdjacentHTML('beforeend',`<p class="chipburst-message" role="status">${escapeHtml(message)}</p>`);status.textContent=message;return;
    }
    const selectedWeek=document.getElementById('ownership-week').value;
    const result=calculate(records,ownership,institutional,selectedWeek,brokerData);
    if (result.prior&&result.current) {
      document.getElementById('ownership-period').textContent=`籌碼統計 ${result.prior.date} → ${result.current.date} · 分點、法人與成交量採同一交易區間`;
      document.getElementById('ownership-provenance').textContent=[result.prior,result.current].some(w=>(w.source||'').includes('github.com'))?'部分週資料為公開歷史留存檔，其餘為官方 OpenAPI':'官方集保 OpenAPI 留存檔';
    }
    if (result.error) {root.insertAdjacentHTML('beforeend',`<p class="chipburst-message" role="status">${escapeHtml(result.error)}</p>`);status.textContent=result.error;return;}
    const lookup=new Map(analyses.map(s=>[s.code,s]));
    const latest=[...new Set(records.filter(s=>result.rows.some(r=>r.code===s.code)).map(s=>s.bars.at(-1).date))].sort();
    root.insertAdjacentHTML('beforeend',`<p class="chipburst-period">統計交易日：${escapeHtml(result.dates.join('、'))}。${latest.length?`收盤價日期：${escapeHtml(latest.join('／'))}。`:''}</p><p class="chipburst-detail-note">篩選：400 張以上大戶持股比例增加、三大法人同期淨買超與分點集中淨額皆為正，且最新成交量大於 500 張。不套用下方型態篩選。</p><details><summary>分數怎麼算／資料來源</summary><p class="chipburst-detail-note">分點來源：<a href="https://stock.capital.com.tw/AP2/rank/index02.asp?l=zco.djhtm&amp;rcid=24&amp;xt=2" target="_blank" rel="noopener">群益公開主力進出</a>。官方核對：<a href="https://bsr.twse.com.tw/bshtm/bsWelcome.aspx" target="_blank" rel="noopener">證交所</a>／<a href="https://www.tpex.org.tw/zh-tw/mainboard/trading/info/brokerBS.html" target="_blank" rel="noopener">櫃買中心</a>（僅當日且逐檔驗證）。</p><p class="chipburst-detail-note">綜合分數（0～100）＝大戶週增相對分數 × 40% ＋ 分點集中度相對分數 × 30% ＋ 法人淨買超力道相對分數 × 30%。大戶週增＝本週 400 張以上持股比例－前週比例；法人力道＝同期間三大法人淨買賣超張數 ÷ 同期間成交量 × 100%。</p><p class="chipburst-detail-note">分點集中度＝（同期間前 15 大買超分點淨買超合計－前 15 大賣超分點淨賣超合計）÷ 同期間成交量 × 100%。三項各自在大戶週增、法人淨額皆正且分點資料完整的候選母體中轉成百分位，同值採平均名次；再由分數高到低取前 30 名。這是相對籌碼強度，不是資金流入百分比或勝率。三項可能包含同一筆資金，不能加總解讀為真實流入金額。分點取群益公開報表的合計張數（四捨五入），不是全體分點加總。</p></details>${result.rows.length?`<div class="chipburst-table-wrap"><table class="chipburst-table"><thead><tr><th>排名</th><th>個股／族群</th><th>綜合分數</th><th>收盤價</th><th>均線分數</th><th>400 張大戶週增</th><th>分點集中淨額</th><th>法人同期淨買超</th></tr></thead><tbody>${result.rows.map((row,i)=>{const stock=lookup.get(row.code);return `<tr><td>${i+1}</td><td><button type="button" data-burst-code="${escapeHtml(row.code)}"><strong>${escapeHtml(stock?.name||row.code)}</strong>${escapeHtml(row.code)}<small>${stock?escapeHtml(industryLabel(stock)):''}</small></button></td><td><span class="chipburst-score">${number(row.score,1)}</span><small>／100 · 三項</small></td><td>${number(stock?.t.close)}</td><td>${Number.isFinite(stock?.score)?stock.score+'／15':'資料不足'}</td><td class="chipburst-buy">${signed(row.holderDelta)}<small>個百分點 · ${number(row.holderPrior)}% → ${number(row.holderNow)}%</small></td><td class="chipburst-buy">${signed(row.brokerNet)} 張<small>集中度 ${signed(row.brokerRatio)}%</small><small>買超 ${number(row.brokerBuy,0)}／賣超 ${number(row.brokerSell,0)}</small></td><td class="chipburst-buy">${signed(row.institutionalNet)} 張<small>占同期成交量 ${signed(row.institutionalRatio)}%</small></td></tr>`}).join('')}</tbody></table></div>`:'<p class="chipburst-message">此區間沒有三項籌碼同時正向的個股。</p>'}`);
    status.textContent=`成交量符合 ${result.universe} 檔 · 大戶與法人雙正向候選 ${result.candidates} 檔 · 分點完整 ${result.complete} 檔 · ${result.excluded} 檔分點缺漏排除 · 三項正向 ${result.eligible} 檔，顯示 ${result.rows.length} 名`;
    root.querySelectorAll('[data-burst-code]').forEach(button=>button.addEventListener('click',()=>{const stock=lookup.get(button.dataset.burstCode);if(stock)openStockDetail(stock,button);}));
  }
  const original=renderOwnership;
  renderOwnership=function(...args) {
    original.apply(this,args);
    const note=document.querySelector('.ownership-foot > .ownership-note');
    if(note)note.hidden=ownershipMode==='chipburst';
    if(ownershipMode==='chipburst')renderBurst();
  };
  window.addEventListener('cb-chip-data-ready',()=>{if(ownershipMode==='chipburst')renderBurst();});
  fetch('broker-data.json',{cache:'no-cache'}).then(response=>{if(!response.ok)throw new Error('分點資料讀取失敗，請重新整理。');return response.json();}).then(data=>{if(data.version!==1||!Array.isArray(data.periods))throw new Error('分點資料格式錯誤。');brokerData=data;if(ownershipMode==='chipburst')renderBurst();}).catch(error=>{brokerError=error.message;if(ownershipMode==='chipburst')renderBurst();});
  if(ownershipMode==='chipburst')renderBurst();
})();

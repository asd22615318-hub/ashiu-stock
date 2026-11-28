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

  function revenueTurnaround(revenue,quote){
    if(!revenue||!quote||!Number.isFinite(revenue.yoy)||!Number.isFinite(revenue.previous_yoy))return null;
    const [year,month]=revenue.month.split('-').map(Number),expected=(month===1?year-1:year)+'-'+String(month===1?12:month-1).padStart(2,'0');
    const turnaround=revenue.previous_yoy<0&&revenue.yoy>0;
    const acceleration=revenue.previous_yoy>0&&revenue.yoy>revenue.previous_yoy;
    if(revenue.previous_month!==expected||!(turnaround||acceleration))return null;
    const bars=quote.bars;if(!Number.isFinite(bars.at(-1)?.volume)||bars.at(-1).volume<500)return null;
    if(bars.length<240||bars.slice(-240).some(b=>!Number.isFinite(b.close)||b.close<=0))return null;
    const annual=bars.slice(-240).reduce((sum,b)=>sum+b.close,0)/240,gap=bars.at(-1).close/annual-1;
    return Math.abs(gap)<=.10+1e-9?{annual,gap,route:turnaround?'由負轉正':'正成長加速'}:null;
  }
  function sustainedPositive(revenue,quote){
    if(!revenue||!quote)return null;
    const [year,month]=revenue.month.split('-').map(Number),history=revenue.yoy_history||{};
    let streak=0,first=month;
    for(let m=month;m>=1;m--){
      const key=year+'-'+String(m).padStart(2,'0');
      if(!Number.isFinite(history[key])||history[key]<=0)break;
      streak++;first=m;
    }
    if(streak<2)return null;
    const before=first===1?(year-1)+'-12':year+'-'+String(first-1).padStart(2,'0');
    if(!Number.isFinite(history[before])||history[before]>=0)return null;
    const bars=quote.bars;
    if(bars.length<240||!Number.isFinite(bars.at(-1).volume)||bars.at(-1).volume<500||bars.slice(-240).some(b=>!Number.isFinite(b.close)||b.close<=0))return null;
    const annual=bars.slice(-240).reduce((sum,b)=>sum+b.close,0)/240,gap=bars.at(-1).close/annual-1;
    return Math.abs(gap)<=.10+1e-9?{annual,gap,streak,turned:year+'-'+String(first).padStart(2,'0')}:null;
  }
  function revenueSectorStrength(groups,stocks){
    const dates=[...new Set([...stocks.values()].flatMap(s=>s.bars.slice(-6).map(b=>b.date)))].sort().slice(-6),end=dates.at(-1),start=dates[0];
    const members=new Map(),ranked=[];
    for(const [name,codes] of groups){
      const returns=[];
      for(const code of new Set(codes)){
        if(!members.has(code))members.set(code,[]);
        const stock=stocks.get(code),bars=stock?.bars||[],first=bars.find(b=>b.date===start),last=bars.at(-1);
        if(dates.length===6&&last?.date===end&&Number.isFinite(first?.close)&&first.close>0&&Number.isFinite(last.close)&&last.close>0)returns.push(last.close/first.close-1);
      }
      if(returns.length>=3)ranked.push({name,value:average(returns),coverage:returns.length});
    }
    ranked.sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
    ranked.forEach((g,i)=>{
      const same=ranked.filter(t=>Math.abs(t.value-g.value)<1e-12),first=ranked.findIndex(t=>t===same[0]),rank=first+(same.length+1)/2;
      const position=ranked.length>1?(rank-1)/(ranked.length-1):.5;
      Object.assign(g,{rank,total:ranked.length,bucket:position<=.2?'strong':position>=.8?'weak':'normal'});
    });
    const ranking=new Map(ranked.map(g=>[g.name,g]));
    for(const [name,codes] of groups)for(const code of new Set(codes)){
      if(!members.has(code))members.set(code,[]);
      members.get(code).push(ranking.get(name)||{name,bucket:'unknown'});
    }
    // Unranked stocks use their official exchange industry only.
    for(const [code,stock] of stocks){
      if(members.get(code)?.length)continue;
      members.set(code,[{name:stock.industry||'官方分類待補',bucket:'unknown',classification:'官方產業'}]);
    }
    return {members,start,end};
  }
  function revenueGroupedCards(rows,card,strength){
    const buckets=[['strong','強勢族群','#ffd66e'],['normal','一般族群','#dce5ef'],['weak','弱勢族群','#8ed8ff'],['unknown','官方分類／強弱待補','#b9c4d0']];
    const entries=rows.map(stock=>{
      let all=(strength.members.get(stock.code)||[]).slice().sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity));
      if(!all.some(g=>Number.isFinite(g.rank)))all=[{name:stock.quote?.industry||'官方分類待補',bucket:'unknown',classification:'官方產業'}];
      return {stock,all,bucket:all.find(g=>Number.isFinite(g.rank))?.bucket||'unknown'};
    });
    const entryHtml=({stock,all})=>'<div style="min-width:0">'+card(stock)+'<p style="color:#dce5ef;overflow-wrap:anywhere">'+(all.length?all.map(g=>esc(g.name)+(Number.isFinite(g.rank)?' #'+Number(g.rank.toFixed(1))+'/'+g.total+' · 5日 '+percent(g.value*100):' · '+(g.classification||'族群強弱資料不足'))).join('<br>'):'尚無對應細分族群')+'</p></div>';
    return '<p style="color:#dce5ef">族群近5日漲幅排名 · '+esc(strength.start||'—')+'～'+esc(strength.end||'—')+'</p>'+
      buckets.map(([key,label,color])=>{
        const selected=entries.filter(e=>e.bucket===key);
        let content=selected.map(entryHtml).join('');
        if(key==='unknown'){
          const categories=new Map();
          for(const entry of selected){
            const name=entry.stock.quote?.industry||'官方分類待補';
            if(!categories.has(name))categories.set(name,[]);
            categories.get(name).push(entry);
          }
          content=[...categories].map(([name,members])=>'<details open style="grid-column:1/-1;min-width:0;border:1px solid #344052;border-radius:8px;padding:10px"><summary style="font-weight:800;color:#ffe298;cursor:pointer">'+esc(name)+' · '+members.length+' 檔</summary><div class="revenue-members" style="margin-top:10px">'+members.map(entryHtml).join('')+'</div></details>').join('');
        }
        return '<details open style="grid-column:1/-1;min-width:0;border:1px solid #746346;border-radius:10px;padding:12px;margin-top:10px"><summary style="color:'+color+';font-size:17px;font-weight:800;cursor:pointer">'+label+' · '+selected.length+' 檔<span style="font-size:13px;margin-left:10px;color:#dce5ef">展開／收合</span></summary><div class="revenue-members" style="margin-top:12px">'+content+'</div></details>';
      }).join('');
  }
  window.renderRevenue = function renderRevenueRadar() {
    const root = $('revenue');
    if (!root) return;
    const groups = window.getHotSectorGroups?.() || new Map();
    const stockIndex = new Map(analyses.map(stock => [stock.code, stock]));
    const turns=Object.entries(report?.stocks||{}).filter(([,r])=>market==='all'||r.market===market).map(([code,revenue])=>({code,revenue,quote:stockIndex.get(code),name:revenue.name,result:revenueTurnaround(revenue,stockIndex.get(code))})).filter(s=>s.result&&(!query|| (s.code+' '+s.name).toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>(b.quote.score??-1)-(a.quote.score??-1)||a.code.localeCompare(b.code));
    const sustained=Object.entries(report?.stocks||{}).filter(([,r])=>market==='all'||r.market===market).map(([code,revenue])=>({code,revenue,quote:stockIndex.get(code),name:revenue.name,result:sustainedPositive(revenue,stockIndex.get(code))})).filter(s=>s.result&&(!query||(s.code+' '+s.name).toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>(b.quote.score??-1)-(a.quote.score??-1)||a.code.localeCompare(b.code));
    const sectorStrength=revenueSectorStrength(groups,stockIndex);
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
      <details class="revenue-turns" open><summary style="color:#ffe298;font-size:20px;font-weight:800;line-height:1.5">營收轉強・年線附近 <small>${turns.length} 檔</small></summary><div class="revenue-members">${turns.length?revenueGroupedCards(turns,s=>'<article style="border:1px solid #746346;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere"><button type="button" class="revenue-stock-open" data-code="'+esc(s.code)+'" style="background:none;border:0;color:#ffe298;font-weight:700">'+esc(s.code)+' '+esc(s.name)+' ↗</button><p style="color:#dce5ef">營收月份 '+esc(s.revenue.month)+' · <strong style="color:#ffe298">'+esc(s.result.route)+'</strong>'+' · <strong style="color:#8ed8ff;font-weight:800">前月 '+percent(s.revenue.previous_yoy)+'</strong> → <strong style="color:#8ed8ff;font-weight:800">'+percent(s.revenue.yoy)+'</strong><br>收盤 '+fmt(s.quote.t.close)+' · MA240 '+fmt(s.result.annual)+' · <strong style="color:#ffb36e;font-weight:800">年線乖離 '+percent(s.result.gap*100)+'</strong><br>均線 '+(s.quote.score??'待補')+'／15 · 行情 '+esc(s.quote.t.date)+'</p></article>',sectorStrength):'<p>目前沒有資料齊全且符合的個股；缺少前月營收或240日線不列入。</p>'}</div></details>
      <details class="revenue-turns" open><summary style="color:#ffe298;font-size:20px;font-weight:800;line-height:1.5">今年轉正後持續正成長 <small>${sustained.length} 檔</small></summary><div class="revenue-members">${sustained.length?revenueGroupedCards(sustained,s=>'<article style="border:1px solid #746346;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere"><button type="button" class="revenue-stock-open" data-code="'+esc(s.code)+'" style="background:none;border:0;color:#ffe298;font-weight:700">'+esc(s.code)+' '+esc(s.name)+' ↗</button><p style="color:#dce5ef"><strong style="color:#8ed8ff">'+esc(s.result.turned)+' 轉正 · 連續 '+s.result.streak+' 個月年增為正</strong><br>最新營收 '+esc(s.revenue.month)+' · <strong style="color:#8ed8ff">'+percent(s.revenue.yoy)+'</strong><br>收盤 '+fmt(s.quote.t.close)+' · MA240 '+fmt(s.result.annual)+' · <strong style="color:#ffb36e">年線乖離 '+percent(s.result.gap*100)+'</strong><br>均線 '+(s.quote.score??'待補')+'／15 · 行情 '+esc(s.quote.t.date)+'</p></article>',sectorStrength):'<p>目前沒有資料齊全且符合的個股；須今年曾由負轉正、連續至少2個月直到最新月年增率皆＞0、年線±10%、成交量≥500張。缺月不跨月補算。</p>'}</div></details>
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


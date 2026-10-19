(() => {
  'use strict';
  const events = [
    {name:'TPCA Show 2026 台灣電路板產業國際展覽會',start:'2026-10-20',end:'2026-10-22',place:'台北南港展覽館',topic:'AI × PCB × 先進封裝；高效能電路板、材料與製程設備',groups:['PCB 製板','PCB 載板','銅箔基板 CCL','PCB鑽孔鑽針頭概念','CoWoS'],url:'https://www.tpca.org.tw/web/news_detail.php?menu_no=161&mod_no=1&news_no=500394'},
    {name:'electronica 2026 慕尼黑電子展',start:'2026-11-10',end:'2026-11-13',place:'德國慕尼黑',topic:'電子元件、車用電子、嵌入式系統與智慧能源',groups:['被動元件','連接器','PMIC（電源管理IC）','MCU（微控制器）','電子通路'],url:'https://electronica.de/en/'},
    {name:'CES 2027 國際消費性電子展',start:'2027-01-06',end:'2027-01-09',place:'美國拉斯維加斯',topic:'消費電子、AI、智慧移動與物聯網',groups:['AI 伺服器','散熱','光學鏡頭','面板','工業電腦'],url:'https://www.ces.tech/attend/registration-notification'},
    {name:'TIMTOS 2027 台北國際工具機展',start:'2027-03-02',end:'2027-03-06',place:'台北南港展覽館 1、2 館',topic:'工業 AI、機器人、自動化、精密加工與綠色製造',groups:['機器人／自動化','工業電腦','PCB鑽孔鑽針頭概念'],url:'https://www.tami.org.tw/news/exhibition-detail/4'},
    {name:'COMPUTEX 2027 台北國際電腦展',start:'2027-06-01',end:'2027-06-04',place:'台北南港展覽館、世貿與台北國際會議中心',topic:'AI 運算、機器人與智慧移動、次世代科技',groups:['AI 伺服器','散熱','矽光子／CPO','PCB 載板','ASIC（特定應用積體電路）'],url:'https://www.computextaipei.com.tw/zh-tw/index.html'},
    {name:'SEMICON Taiwan 2027 國際半導體展',start:'2027-08-18',end:'2027-08-20',place:'台灣；場館細節依主辦公告',topic:'半導體製造、先進封裝、材料、設備與測試供應鏈',groups:['CoWoS','半導體探針卡','矽晶圓','特用化學','功率半導體'],url:'https://semicontaiwan.org/zh'},
    {name:'Energy Taiwan 2026 台灣國際智慧能源週',start:'2026-10-14',end:'2026-10-16',place:'台北南港展覽館',topic:'太陽光電、風力能源、儲能與淨零永續',groups:['重電','電池模組','鈣鈦礦'],url:'https://cloudcdn.taiwantradeshows.com.tw/2026/energytaiwan/kv/kv-ch.pdf'}
  ];
  const root=document.getElementById('exhibitions');
  if(!root)return;
  let period='upcoming',theme='',query='';
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const days=(from,to)=>Math.round((Date.parse(to+'T00:00:00+08:00')-Date.parse(from+'T00:00:00+08:00'))/86400000);
  function status(event,date){return date>event.end?'已結束':date>=event.start?'展覽進行中':`距開展 ${days(date,event.start)} 天`;}
  function render(){
    const date=today(),groups=window.getHotSectorGroups?.()||new Map();
    const stocks=new Map((typeof records==='undefined'?[]:records).map(s=>[s.code,s]));
    const analysis=new Map((typeof analyses==='undefined'?[]:analyses).map(s=>[s.code,s]));
    const selected=events.filter(e=>{
      const delta=days(date,e.start);
      return (period==='all'||(e.end>=date&&(period==='upcoming'||delta<=Number(period))))&&(!theme||e.groups.includes(theme));
    }).map(event=>{
      const members=new Map();
      for(const group of event.groups)for(const code of groups.get(group)||[]){
        if(!members.has(code))members.set(code,{code,groups:[]});
        members.get(code).groups.push(group);
      }
      const items=[...members.values()].filter(m=>{
        const s=stocks.get(m.code),a=analysis.get(m.code);
        return !query||`${m.code} ${s?.name||a?.name||''} ${event.name} ${event.topic} ${m.groups.join(' ')}`.toLowerCase().includes(query.toLowerCase());
      }).sort((a,b)=>(analysis.get(b.code)?.score??-1)-(analysis.get(a.code)?.score??-1)||a.code.localeCompare(b.code));
      return {event,items};
    }).filter(x=>!query||x.items.length).sort((a,b)=>(a.event.end<date)-(b.event.end<date)||a.event.start.localeCompare(b.event.start));
    const themes=[...new Set(events.flatMap(e=>e.groups))];
    root.innerHTML=`<div class="sector-heading"><h1>產業展覽題材雷達</h1><p>展覽時間 × 產業題材 × 台股關聯個股</p></div><section class="sector-capital"><div class="expo-controls"><label>展覽期間<select id="expo-period"><option value="upcoming">即將舉辦／進行中</option><option value="30">未來 30 天</option><option value="90">未來 90 天</option><option value="all">全部（含已結束）</option></select></label><label>題材族群<select id="expo-theme"><option value="">全部題材</option>${themes.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></label><form id="expo-search"><label>搜尋展覽／個股<input id="expo-query" type="search" placeholder="例如 CoWoS、家登、3680" value="${esc(query)}"></label><button type="submit">確認</button></form></div><p class="sector-capital-note">共 ${selected.length} 場 · 台灣日期 ${date} · 展期查核：2026/10/19。日期為展覽所在地日期，異動以官方公告為準。</p><p class="sector-capital-note">個股依現有族群與產品方向對應，為產業關聯名單，不代表已確認參展或取得訂單。展覽題材為整理摘要；完整內容請看官方來源。</p></section><div class="expo-list">${selected.map(({event:e,items})=>`<article class="sector-capital expo-card"><div class="expo-card-head"><span class="expo-status ${e.end<date?'expo-ended':''}">${status(e,date)}</span><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">官方展期 ↗</a></div><h2>${esc(e.name)}</h2><p class="expo-date"><time datetime="${e.start}">${e.start.replaceAll('-','/')}</time> — <time datetime="${e.end}">${e.end.replaceAll('-','/')}</time></p><p>${esc(e.place)}</p><p class="expo-topic">${esc(e.topic)}</p><div class="expo-tags">${e.groups.map(g=>`<span>${esc(g)}</span>`).join('')}</div><details class="sector-subgroup"><summary>關聯個股 · ${items.length} 檔（依均線分數）</summary><div class="expo-stocks">${items.map(m=>{
      const s=stocks.get(m.code),a=analysis.get(m.code),bar=s?.bars?.at(-1);
      return `<button type="button" class="expo-stock" data-expo-code="${m.code}" ${a?'':'disabled'}><strong>${esc(s?.name||a?.name||m.code)} <small>${m.code}</small></strong><span>${bar?`收盤 ${fmt(bar.close)} · ${esc(bar.date)}`:'行情尚未載入'}</span><span class="expo-score">均線 ${a?.score==null?'待補資料':a.score+' / 15'}</span><small>${m.groups.map(esc).join(' · ')}</small></button>`;
    }).join('')||'<p>行情載入後可查看關聯個股。</p>'}</div></details></article>`).join('')||'<section class="sector-capital"><p>目前沒有符合條件的展覽或關聯個股，請調整篩選。</p></section>'}</div>`;
    root.querySelector('#expo-period').value=period;
    root.querySelector('#expo-theme').value=theme;
    root.querySelector('#expo-period').addEventListener('change',e=>{period=e.target.value;render();});
    root.querySelector('#expo-theme').addEventListener('change',e=>{theme=e.target.value;render();});
    root.querySelector('#expo-search').addEventListener('submit',e=>{e.preventDefault();query=root.querySelector('#expo-query').value.trim();render();});
    root.querySelectorAll('[data-expo-code]').forEach(b=>b.addEventListener('click',()=>{const s=analysis.get(b.dataset.expoCode);if(s)openStockDetail(s,b);}));
  }
  document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>{root.hidden=b.dataset.view!=='exhibitions';if(!root.hidden)render();}));
  window.addEventListener('cb-chip-data-ready',()=>{if(!root.hidden)render();});
})();

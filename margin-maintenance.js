(function(){
  'use strict';
  function summarize(data,now=Date.now()){
    const today=new Date(now+8*3600000).toISOString().slice(0,10);
    const rows=[...new Map((data?.rows||[]).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&r.date<=today&&Number.isFinite(r.value)&&r.value>0).map(r=>[r.date,r])).values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-120);
    if(!rows.length)return null;
    const latest=rows.at(-1),n=rows.length,v=latest.value;
    const less=rows.filter(r=>r.value<v).length,equal=rows.filter(r=>r.value===v).length;
    const percentile=n>=20?100*(less+(equal-1)/2)/(n-1):null;
    const stale=now-Date.parse(latest.date+'T00:00:00+08:00')>4*86400000;
    const label=stale?'舊資料，暫不判斷':percentile===null?'歷史不足，暫不判斷':percentile<=20?'近期偏低':percentile>=80?'近期偏高':'近期適中';
    const buffer=v<140?'緩衝偏薄，留意市場追繳壓力':v<160?'緩衝較低，留意維持率續降':'擔保緩衝相對較足';
    return {...latest,n,percentile,label,buffer,stale,change:n>1?v-rows.at(-2).value:null};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={summarize};
  if(typeof window==='undefined')return;
  let data=null,loading=false,lastLoad=0,saved=false,error='';
  const fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('zh-TW',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.marginMaintenanceHtml=function(){
    const r=summarize(data);
    if(!r)return `<small>融資維持率觀察</small><strong>${loading?'資料讀取中…':'資料待補'}</strong><p>${error?'官方資料暫時無法取得，請按「更新籌碼資料」重試。':'官方全市場擔保維持率（融資＋融券）。'}</p>`;
    return `<small>融資維持率觀察 · 全市場</small><strong style="color:#f1d79e">${fmt(r.value)}%</strong><p><b>${r.label}</b>${r.percentile===null?'':` · 近 ${r.n} 筆第 ${fmt(r.percentile,0)} 百分位`}<br>${esc(r.buffer)}<br>較前筆 ${r.change>0?'+':''}${fmt(r.change)} 個百分點<br>資料日 ${esc(r.date)}${saved?' · 保存資料':''}</p><details style="margin-top:10px"><summary style="cursor:pointer;color:#f1d79e;font-size:13px">高低怎麼判讀</summary><p>相同官方口徑最近最多 120 筆有效資料：低於或等於第 20 百分位為偏低，高於或等於第 80 百分位為偏高，其間為適中；少於 20 筆不判斷。較高代表擔保緩衝較足，不代表股價過熱；較低不等於買點。</p><p>緩衝觀察分區：低於 140% 偏薄、140%～未滿 160% 較低、160% 以上相對較足；這是本站觀察規則。官方整戶追繳門檻 130% 適用個別信用帳戶，不能以市場平均判斷個人是否須追繳。</p><p>採官方全市場融資融券合併擔保維持率，並非純融資估算或個人帳戶維持率；自 2026/8/3 開始提供，目前 ${r.n} 筆。${r.stale?'資料已逾 4 天，暫停目前高低判斷。':''}${saved?'即時來源暫時失敗，顯示最近保存的官方資料。':''}</p><a href="https://www.twse.com.tw/dashboard/zh/credit/margin.html" target="_blank" rel="noopener" style="color:#88decb">證交所官方資料與說明</a></details>`;
  };
  function paint(){const box=document.getElementById('fc-margin-summary');if(box)box.innerHTML=window.marginMaintenanceHtml();}
  async function load(force=false){
    if(loading||(!force&&Date.now()-lastLoad<600000))return;
    loading=true;paint();
    try{
      const response=await fetch('/api/margin-maintenance',{cache:force?'reload':'default',signal:AbortSignal.timeout(18000)});
      if(!response.ok)throw Error('upstream');
      const incoming=await response.json();if(!summarize(incoming))throw Error('invalid');
      data=incoming;saved=false;error='';lastLoad=Date.now();
      try{localStorage.setItem('ashiu-margin-maintenance-v1',JSON.stringify(data));}catch{}
    }catch{
      saved=true;error='unavailable';
      const choices=[data];
      try{choices.push(JSON.parse(localStorage.getItem('ashiu-margin-maintenance-v1')||'null'));}catch{}
      try{const r=await fetch('margin-maintenance-data.json');if(r.ok)choices.push(await r.json());}catch{}
      data=choices.filter(d=>summarize(d)).sort((a,b)=>summarize(b).date.localeCompare(summarize(a).date))[0]||null;
    }finally{loading=false;paint();}
  }
  document.querySelector('[data-view="futchip"]')?.addEventListener('click',()=>load());
  document.getElementById('futchip')?.addEventListener('click',ev=>{if(ev.target.closest('#fc-refresh,#fc-retry'))load(true);});
})();

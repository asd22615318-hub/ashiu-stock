(function(){
 'use strict';
 function score(bars){
  const values=bars.map(x=>x.close),i=values.length-1,last=values[i],ma=n=>values.length>=n?values.slice(-n).reduce((a,b)=>a+b,0)/n:null;
  const stand=[5,10,20,60,120,240].map(n=>ma(n)===null?null:last>=ma(n));
  const fresh=[5,10,20,60,120,360].map(n=>i>=n?last>Math.max(...values.slice(i-n,i-2)):null);
  const order=[[20,60],[60,120],[120,360]].map(([a,b])=>ma(a)===null||ma(b)===null?null:ma(a)>ma(b));
  const rules=[...stand,...fresh,...order];return {score:rules.includes(null)?null:rules.filter(Boolean).length,known:rules.filter(x=>x===true).length,missing:rules.filter(x=>x===null).length,ma};
 }
 if(typeof module==='object'&&module.exports){module.exports={score};return;}
 const root=document.getElementById('market-overview');if(!root)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number(v).toLocaleString('zh-TW',{maximumFractionDigits:2});
 fetch('market-overview-data.json',{cache:'no-cache'}).then(async r=>{if(!r.ok)throw Error('市場資料暫時無法載入');return r.json();}).then(d=>{
  root.innerHTML='<div class="ownership-disclosure"><h2>台股市場均線觀察</h2><button id="market-overview-toggle" type="button" class="ghost" aria-expanded="false" aria-controls="market-overview-content">展開市場均線 ▾</button></div><div id="market-overview-content" hidden><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px">'+d.items.map(item=>{
   if(!item.bars?.length)return `<article class="cb-watch-item"><h3>${esc(item.name)}</h3><p>歷史資料待補</p></article>`;
   const s=score(item.bars),last=item.bars.at(-1),prev=item.bars.at(-2),delta=prev?last.close-prev.close:null,quote=item.latest_quote,displayPrice=quote?.price??last.close,displayDelta=quote?.change??delta;
   return `<article class="cb-watch-item"><h3>${esc(item.name)}</h3><p style="font-size:1.4em;font-weight:700;color:${displayDelta>=0?'#ff647b':'#4dd5bd'}">${fmt(displayPrice)}<small style="display:block;font-size:14px">${displayDelta>=0?'+':''}${fmt(displayDelta)} 點 · ${quote?fmt(quote.change_pct):prev?fmt(delta/prev.close*100):'—'}%</small></p><p style="color:#ffb36e;font-size:1.15em;font-weight:700">均線 ${s.score===null?`${s.known} 項符合／${s.missing} 項待補`:s.score+' / 15'}</p><strong style="color:${s.score>=6?'#ffe298':'#c9d5e3'}">${s.score===null?'歷史不足，暫不判定':s.score>=6?'6 分以上，可分批進場觀察':'未達 6 分，等待觀察'}</strong>${quote?`<p>最新夜盤報價 ${fmt(quote.price)}<small style="display:block">來源日期 ${esc(quote.source_date)} · 時間 ${esc(quote.source_time)} · ${esc(quote.symbol)}</small><small>行情快照，非即時串流；均線分數依下列已完成日線。</small></p>`:''}<p>均線資料日 ${esc(last.date)}${last.contract?' · 合約 '+esc(last.contract):''}</p>${last.session?`<p>${esc(last.session)}<small style="display:block">夜盤收盤 ${last.night_close==null?'無資料':fmt(last.night_close)} · 全日高 ${fmt(last.high)}／低 ${fmt(last.low)}</small></p>`:''}<details><summary>均線與資料來源</summary><p>${[5,10,20,60,120,240].map(n=>'MA'+n+' '+(s.ma(n)===null?'待補':fmt(s.ma(n)))).join(' · ')}</p><p>${esc(item.source)}</p><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">來源 ↗</a></details></article>`;
  }).join('')+'</div><p class="chipburst-detail-note">沿用個股 15 分計法：6 項站上均線、6 項創高、3 項均線排列。6 分門檻為自訂進場觀察標記；非即時報價。台指近全包含日盤與夜盤，依官方交易日合併；完整交易日採日盤收盤，僅夜盤完成時採夜盤收盤。為未還原換月串接，換月價差可能影響分數。</p></div>';
  const toggle=root.querySelector('#market-overview-toggle'),content=root.querySelector('#market-overview-content');toggle.addEventListener('click',()=>{content.hidden=!content.hidden;toggle.setAttribute('aria-expanded',String(!content.hidden));toggle.textContent=content.hidden?'展開市場均線 ▾':'收合市場均線 ▴';});
 }).catch(e=>{root.textContent=e.message;});
})();
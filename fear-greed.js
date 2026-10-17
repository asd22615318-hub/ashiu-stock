(function(){
  'use strict';
  const bands=[[0,25,'極度恐懼','#50c8a5'],[25,45,'恐懼','#9bc574'],[45,55,'中立','#e7cb7b'],[55,75,'貪婪','#e9a163'],[75,100,'極度貪婪','#e67585']];
  function emotion(v){if(!Number.isFinite(v)||v<0||v>100)return null;return bands.find((b,i)=>v>=b[0]&&(v<b[1]||i===4));}
  function cleanRows(data){return [...new Map((Array.isArray(data?.rows)?data.rows:[]).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&emotion(r.score)).map(r=>[r.date,r])).values()].sort((a,b)=>a.date.localeCompare(b.date));}
  if(typeof module!=='undefined'&&module.exports)module.exports={emotion,cleanRows};
  if(typeof document==='undefined')return;
  const root=document.getElementById('futchip');if(!root)return;
  const css=document.createElement('style');css.textContent=`#futchip .fg-panel{margin-top:24px;background:var(--panel,#1a2028)}#futchip .fg-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}#futchip .fg-head h2{font-size:21px;color:#f1d79e}#futchip .fg-caption{font-size:13px}#futchip .fg-overview{display:grid;grid-template-columns:minmax(280px,440px) 1fr;gap:24px;align-items:center;margin-top:12px}#futchip .fg-gauge{width:100%;max-width:440px;display:block;margin:auto}#futchip .fg-snapshots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#futchip .fg-snapshot{padding:14px;background:#0c1624;border:1px solid #384347;border-radius:11px}#futchip .fg-snapshot:first-child{grid-column:1/-1}#futchip .fg-snapshot small{display:block;font-size:12px;color:#b9c7c2}#futchip .fg-snapshot strong{display:block;font-size:22px;margin:7px 0}#futchip .fg-range{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:22px 0 12px}#futchip .fg-range button{padding:7px 12px;font-size:14px}#futchip .fg-range button[aria-pressed=true]{border-color:#d8b65f;color:#f1d79e;background:#343025}#futchip .fg-chart-wrap{border:1px solid #384347;border-radius:12px;padding:12px 4px 4px;background:#0c1624}#futchip .fg-chart{width:100%;height:340px;display:block;touch-action:pan-y}#futchip .fg-readout{min-height:24px;padding:2px 14px 10px;font-size:14px;color:#e4dfd0;font-variant-numeric:tabular-nums}#futchip .fg-legend{display:flex;gap:18px;flex-wrap:wrap;font-size:13px;margin:12px 0;color:#c9d4ce}#futchip .fg-legend i{display:inline-block;width:18px;height:3px;margin-right:5px;vertical-align:middle}#futchip .fg-bands{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}#futchip .fg-bands span{border:1px solid currentColor;border-radius:18px;padding:5px 10px;font-size:12px}#futchip .fg-note{font-size:13px;color:#b9c7c2}#futchip .fg-note a{color:#88decb}#futchip .fg-table td,#futchip .fg-table th{font-size:14px;padding:10px}#futchip .fg-warning{color:#e7cb7b!important}@media(max-width:850px){#futchip .fg-overview{grid-template-columns:1fr;gap:8px}}@media(max-width:500px){#futchip .fg-panel{padding:14px}#futchip .fg-chart{height:290px}#futchip .fg-snapshots{gap:8px}#futchip .fg-snapshot{padding:10px}}`;
  document.head.append(css);
  let data=null,loading=false,lastLoad=0,saved=false,range=12,hover=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(n,d=0)=>Number.isFinite(n)?n.toLocaleString('zh-TW',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const box=()=>document.getElementById('fc-fear-greed');
  const polar=(v,r)=>[220+r*Math.cos(Math.PI*(v/100-1)),195+r*Math.sin(Math.PI*(v/100-1))];
  function gauge(score){
    const b=emotion(score),p=polar(score,132);
    return `<svg class="fg-gauge" viewBox="0 0 440 280" role="img" aria-label="美股恐懼與貪婪指數 ${fmt(score)}，${b[2]}，0為極度恐懼、100為極度貪婪"><title>恐懼與貪婪情緒儀表</title>${bands.map(([lo,hi,,color])=>{const a=polar(lo+.6,155),z=polar(hi-.6,155);return `<path d="M ${a.join(' ')} A 155 155 0 0 1 ${z.join(' ')}" fill="none" stroke="${color}" stroke-width="28"/>`;}).join('')}${[0,25,50,75,100].map(v=>{const p=polar(v,184);return `<text x="${p[0]}" y="${p[1]+5}" text-anchor="middle" fill="#b9c7c2" font-size="15">${v}</text>`;}).join('')}<line x1="220" y1="195" x2="${p[0]}" y2="${p[1]}" stroke="#f4eee0" stroke-width="5" stroke-linecap="round"/><circle cx="220" cy="195" r="9" fill="#f1d79e"/><text x="220" y="252" text-anchor="middle" fill="${b[3]}" font-size="43" font-weight="750">${fmt(score)} · ${b[2]}</text></svg>`;
  }
  function selected(){const rows=cleanRows(data);if(!rows.length||range===0)return rows;const cutoff=new Date(rows.at(-1).date+'T00:00:00Z');cutoff.setUTCMonth(cutoff.getUTCMonth()-range);return rows.filter(r=>r.date>=cutoff.toISOString().slice(0,10));}
  function shift(date,days=0,months=0){const d=new Date(date+'T00:00:00Z');if(months){const n=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-months);d.setUTCDate(Math.min(n,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));}d.setUTCDate(d.getUTCDate()-days);return d.toISOString().slice(0,10);}
  function paint(){
    const el=box();if(!el)return;el.dataset.fgMounted='1';
    const rows=cleanRows(data),last=rows.at(-1);
    if(!last){el.innerHTML=`<div class="fg-head"><h2>美國恐懼與貪婪指數</h2></div><p role="status">${loading?'正在讀取美股市場情緒資料…':'指數資料暫時無法取得，請稍後重試。'}</p><button class="ghost" data-fg-refresh>重新載入</button>`;el.querySelector('[data-fg-refresh]').onclick=()=>load(true);return;}
    const stale=Date.now()-Date.parse(data.updatedAt||last.date+'T00:00:00Z')>5*86400000;
    const atOrBefore=date=>[...rows].reverse().find(r=>r.date<=date);
    const snaps=[['當日',last],['前一交易日',rows.at(-2)],['一週前',atOrBefore(shift(last.date,7))],['一個月前',atOrBefore(shift(last.date,0,1))],['一年前',atOrBefore(shift(last.date,0,12))]];
    el.innerHTML=`<div class="fg-head"><div><h2>美國恐懼與貪婪指數</h2><p class="fg-caption">美股市場情緒 · 資料日 ${esc(last.date)}（美國交易日）</p></div><button class="ghost" data-fg-refresh ${loading?'disabled':''}>${loading?'更新中…':'更新指數'}</button></div>${saved||stale?`<p class="fg-note fg-warning" role="status">${stale?'資料已逾 5 天，請留意更新日期。':''}${saved?'即時來源暫時無法取得，顯示最近保存資料。':''}</p>`:''}<div class="fg-overview">${gauge(last.score)}<div class="fg-snapshots">${snaps.map(([label,r])=>`<div class="fg-snapshot"><small>${label}${r?' · '+r.date:''}</small><strong style="color:${emotion(r?.score)?.[3]||'#b9c7c2'}">${r?fmt(r.score)+' · '+emotion(r.score)[2]:'資料不足'}</strong></div>`).join('')}</div></div><div class="fg-bands">${bands.map(([lo,hi,label,c],i)=>`<span style="color:${c}">${label} ${lo}～${i===4?100:hi-1}</span>`).join('')}</div><div class="fg-range"><span>市場情緒歷史走勢</span>${[[3,'3個月'],[6,'6個月'],[12,'1年'],[36,'3年'],[0,'全部']].map(([v,label])=>`<button class="ghost" data-fg-range="${v}" aria-pressed="${range===v}">${label}</button>`).join('')}</div><div class="fg-chart-wrap"><canvas class="fg-chart" tabindex="0" role="img" aria-label="恐懼與貪婪指數及S&P500歷史走勢，左右方向鍵查看每日數值"></canvas><div class="fg-readout" aria-live="polite"></div></div><div class="fg-legend"><span><i style="background:#f1d79e"></i>恐懼與貪婪指數 · 左軸 0～100</span><span><i style="background:#75b7e8"></i>S&P 500 · 右軸點數</span></div><details><summary style="cursor:pointer;color:#f1d79e">最近 5 筆數據</summary><div class="table-wrap"><table class="fg-table"><thead><tr><th>日期</th><th>恐懼與貪婪指數</th><th>S&P 500</th></tr></thead><tbody>${rows.slice(-5).reverse().map(r=>`<tr><td>${r.date}</td><td style="color:${emotion(r.score)[3]}">${fmt(r.score)} · ${emotion(r.score)[2]}</td><td>${fmt(r.sp500,2)}</td></tr>`).join('')}</tbody></table></div></details><p class="fg-note">這是美股市場情緒指標，並非台股或加密貨幣貪婪指數。分數越高越貪婪、越低越恐懼，不能單獨判斷買賣時機。未公布的日期不補值；比較卡採對應日期或之前最近有效資料，區間依原始小數判斷，分數以四捨五入整數顯示。</p><p class="fg-note">來源：${esc(data.sourceKind||'CNN')} · 更新 ${esc(data.updatedAt||'未提供')}<br><a href="https://edition.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener">CNN 指數說明</a> · <a href="https://www.wantgoo.com/global/macroeconomics/fearandgreed" target="_blank" rel="noopener">玩股網參考頁</a>${data.sourceKind?.includes('留存')?' · <a href="https://github.com/whit3rabbit/fear-greed-data" target="_blank" rel="noopener">公開留存來源</a>':''}</p>`;
    el.querySelector('[data-fg-refresh]').onclick=()=>load(true);
    el.querySelectorAll('[data-fg-range]').forEach(b=>b.onclick=()=>{range=Number(b.dataset.fgRange);hover=null;paint();});
    const canvas=el.querySelector('canvas');
    canvas.addEventListener('pointermove',ev=>{const rect=canvas.getBoundingClientRect(),n=selected().length;hover=Math.max(0,Math.min(n-1,Math.round((ev.clientX-rect.left-48)/(rect.width-116)*(n-1))));draw();});
    canvas.addEventListener('pointerleave',()=>{hover=null;draw();});
    canvas.addEventListener('keydown',ev=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;ev.preventDefault();const n=selected().length;hover=ev.key==='Home'?0:ev.key==='End'?n-1:Math.max(0,Math.min(n-1,(hover??n-1)+(ev.key==='ArrowLeft'?-1:1)));draw();});
    requestAnimationFrame(draw);
  }
  function draw(){
    const el=box(),canvas=el?.querySelector('canvas'),rows=selected();if(!canvas||!rows.length||root.hidden)return;
    const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;if(w<120||h<100)return;
    const ratio=window.devicePixelRatio||1;canvas.width=w*ratio;canvas.height=h*ratio;const c=canvas.getContext('2d');c.scale(ratio,ratio);
    const left=48,right=w-68,top=20,bottom=h-36,plotW=right-left,plotH=bottom-top;
    const x=i=>left+(rows.length===1?.5:i/(rows.length-1))*plotW,y=v=>bottom-v/100*plotH;
    for(const [lo,hi,,color] of bands){c.globalAlpha=.06;c.fillStyle=color;c.fillRect(left,y(hi),plotW,(hi-lo)/100*plotH);}c.globalAlpha=1;c.font='12px system-ui';
    c.textAlign='right';for(const v of [0,25,50,75,100]){c.fillStyle='#adbbb9';c.fillText(v,left-9,y(v)+4);c.strokeStyle='#334149';c.beginPath();c.moveTo(left,y(v));c.lineTo(right,y(v));c.stroke();}
    const sp=rows.map(r=>r.sp500).filter(v=>Number.isFinite(v)&&v>0);let min=sp.length?Math.min(...sp):0,max=sp.length?Math.max(...sp):1,pad=(max-min)*.1||max*.02;min-=pad;max+=pad;
    const sy=v=>bottom-(v-min)/(max-min)*plotH;
    c.textAlign='left';if(sp.length){for(let i=0;i<=4;i++){const v=min+(max-min)*i/4;c.fillStyle='#75b7e8';c.fillText(fmt(v),right+9,bottom-i/4*plotH+4);}}
    function line(key,map,color){c.strokeStyle=color;c.lineWidth=key==='score'?2.2:1.7;c.beginPath();let active=false;rows.forEach((r,i)=>{if(!Number.isFinite(r[key])){active=false;return;}if(!active){c.moveTo(x(i),map(r[key]));active=true;}else c.lineTo(x(i),map(r[key]));});c.stroke();}
    line('sp500',sy,'#75b7e8');line('score',y,'#f1d79e');
    c.fillStyle='#aebcb9';const ticks=Math.max(2,Math.min(5,Math.floor(plotW/130)));for(let k=0;k<ticks;k++){const i=Math.round(k/(ticks-1)*(rows.length-1));c.textAlign=k===0?'left':k===ticks-1?'right':'center';c.fillText(rows[i].date,x(i),h-12);}
    const index=Math.max(0,Math.min(rows.length-1,hover??rows.length-1)),r=rows[index];
    if(hover!==null){c.strokeStyle='#92a4a3';c.setLineDash([4,4]);c.beginPath();c.moveTo(x(index),top);c.lineTo(x(index),bottom);c.stroke();c.setLineDash([]);c.fillStyle=emotion(r.score)[3];c.beginPath();c.arc(x(index),y(r.score),4,0,Math.PI*2);c.fill();}
    el.querySelector('.fg-readout').textContent=`${r.date}　${emotion(r.score)[2]} ${fmt(r.score)}　S&P 500 ${fmt(r.sp500,2)} 點`;
  }
  async function load(force=false){
    if(loading||(!force&&Date.now()-lastLoad<1800000)){paint();return;}loading=true;paint();
    try{const r=await fetch('/api/fear-greed',{cache:force?'reload':'default',signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('upstream');const incoming=await r.json();if(cleanRows(incoming).length<10)throw Error('invalid');data=incoming;saved=false;lastLoad=Date.now();try{localStorage.setItem('ashiu-fear-greed-v1',JSON.stringify(data));}catch{}}
    catch{saved=true;const candidates=[data];try{candidates.push(JSON.parse(localStorage.getItem('ashiu-fear-greed-v1')||'null'));}catch{}try{const r=await fetch('fear-greed-data.json');if(r.ok)candidates.push(await r.json());}catch{}data=candidates.filter(d=>cleanRows(d).length>=10).sort((a,b)=>cleanRows(b).at(-1).date.localeCompare(cleanRows(a).at(-1).date))[0]||null;}
    finally{loading=false;paint();}
  }
  new MutationObserver(()=>{const el=box();if(el&&!el.dataset.fgMounted)paint();}).observe(root,{childList:true});
  document.querySelector('[data-view="futchip"]')?.addEventListener('click',()=>load());
  root.addEventListener('click',ev=>{if(ev.target.closest('#fc-refresh,#fc-retry'))load(true);});
  let timer;new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(draw,80);}).observe(root);
})();

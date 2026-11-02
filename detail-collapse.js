// Keep the stock identity visible while each information card can be expanded independently.
document.querySelectorAll('#detail > .detail-section').forEach((section, index) => {
  const heading = section.querySelector(':scope > h3');
  if (!heading) return;
  const body = document.createElement('div');
  body.className = 'detail-collapse-body';
  body.id = `detail-collapse-body-${index}`;
  while (heading.nextSibling) body.append(heading.nextSibling);
  section.append(body);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'detail-collapse-toggle';
  button.setAttribute('aria-controls', body.id);
  button.setAttribute('aria-expanded', 'false');
  while (heading.firstChild) button.append(heading.firstChild);
  const indicator = document.createElement('span');
  indicator.className = 'detail-collapse-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.textContent = '展開 ＋';
  button.append(indicator);
  heading.append(button);
  body.hidden = true;
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expanded));
    indicator.textContent = expanded ? '收合 −' : '展開 ＋';
    body.hidden = !expanded;
    if (expanded && section.classList.contains('daily-chart-card')) {
      const plot = body.querySelector('.daily-plot');
      if (plot) plot.scrollLeft = plot.scrollWidth - plot.clientWidth;
    }
  });
});


(() => {
 const modal=document.getElementById('detail-modal');
 const close=document.getElementById('detail-close');
 if(!modal||!close)return;
 const back=document.createElement('button');
 back.type='button';back.className='detail-floating-back';
 back.textContent='返回';back.setAttribute('aria-label','返回原本個股清單');
 back.addEventListener('click',()=>close.click());
 modal.append(back);
 const style=document.createElement('style');
 style.textContent='.detail-floating-back{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:calc(18px + env(safe-area-inset-bottom));z-index:10000;min-width:76px;min-height:46px;padding:11px 20px;border:1px solid #62877e;border-radius:999px;background:#19322f;color:#fff;font:700 16px system-ui;box-shadow:0 5px 18px #0008;cursor:pointer;touch-action:manipulation}.detail-floating-back:hover{background:#24453f}.detail-floating-back:focus-visible{outline:3px solid #8bc8b5;outline-offset:3px}.detail-modal:not([open])>.detail-floating-back{display:none}.detail-modal #detail{padding-bottom:90px}';
 document.head.append(style);
})();

(() => {
 const ownership=document.getElementById('ownership-content');
 const featured=document.getElementById('featured-radar');
 const button=document.createElement('button');
 button.type='button';button.className='stock-list-floating-back';
 button.textContent='返回';button.hidden=true;
 document.body.append(button);
 const style=document.createElement('style');
 style.textContent='.stock-list-floating-back{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:calc(18px + env(safe-area-inset-bottom));z-index:9000;min-width:76px;min-height:46px;padding:11px 20px;border:1px solid #62877e;border-radius:999px;background:#19322f;color:white;font:700 16px system-ui;box-shadow:0 5px 18px #0008;cursor:pointer;touch-action:manipulation}.stock-list-floating-back[hidden]{display:none}.stock-list-floating-back:hover{background:#24453f}.stock-list-floating-back:focus-visible{outline:3px solid #8bc8b5;outline-offset:3px}';
 document.head.append(style);
 let active=null,pending=false;
 function update(){
  pending=false;active=null;
  if(!document.getElementById('detail-modal')?.open){
   const candidates=[
    {root:ownership,first:ownership?.querySelector('#ownership-rows tr, #chipburst-info tbody tr, #chipburst-info .chipburst-card'),name:'大戶籌碼'},
    {root:featured,first:featured?.querySelector('.fr-card'),name:'精選股'}
   ];
   for(const entry of candidates){
    if(!entry.root||!entry.first||!entry.first.getClientRects().length)continue;
    const area=entry.root.getBoundingClientRect(),row=entry.first.getBoundingClientRect();
    if(row.top < -40 && area.bottom>0 && area.top<window.innerHeight)active=entry;
   }
  }
  const hidden=!active;if(button.hidden!==hidden)button.hidden=hidden;
  if(active)button.setAttribute('aria-label','返回'+active.name+'第一檔');
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(update);}}
 button.addEventListener('click',()=>{active?.first.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
 window.addEventListener('scroll',schedule,{passive:true});
 window.addEventListener('resize',schedule);
 document.addEventListener('toggle',schedule,true);
 document.getElementById('detail-modal')?.addEventListener('close',schedule);
 const observer=new MutationObserver(schedule);
 for(const node of [ownership,featured,document.getElementById('detail-modal')])if(node)observer.observe(node,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open']});
 schedule();
})();

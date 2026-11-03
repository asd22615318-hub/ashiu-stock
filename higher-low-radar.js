(function(){
 'use strict';
 const valid=v=>Number.isFinite(v)&&v>0;
 function drawdown(values){
  if(values.length!==60||!values.every(valid))return null;
  let peak=values[0],worst=0;for(const v of values){peak=Math.max(peak,v);worst=Math.max(worst,(1-v/peak)*100);}return worst;
 }
 function relative(bars,market,date){
  const end=market.findIndex(x=>x.d===date),prices=new Map(bars.map(x=>[x.date,x.close]));
  if(end<5||!market.slice(end-5,end+1).every(x=>valid(x.i)&&valid(prices.get(x.d))))return null;
  return (prices.get(date)/prices.get(market[end-5].d)-market[end].i/market[end-5].i)*100;
 }

 function analyze(bars,market,date){
  if(!Array.isArray(bars)||bars.length<60||bars.at(-1).date!==date||bars.slice(-60).some(x=>!valid(x.close)))return null;
  const n=bars.length-1,ma=i=>i>=19?bars.slice(i-19,i+1).reduce((s,x)=>s+x.close,0)/20:null;
  const byDate=new Map(bars.map(x=>[x.date,x.close])),fall=drawdown(market.slice(-60).map(x=>byDate.get(x.d))),rs=relative(bars,market,date);
  const base={fall,rs,above:bars[n].close>ma(n),ma20:ma(n),ma60:bars.slice(-60).reduce((sum,b)=>sum+b.close,0)/60,stable:bars[n].close>ma(n)&&bars[n-1].close>ma(n-1)};
  const lows=[];for(let k=Math.max(3,n-59);k<=n-3;k++)if(bars.slice(k-3,k).concat(bars.slice(k+1,k+4)).every(x=>bars[k].close<x.close))lows.push(k);
  if(!lows.length)return {...base,pattern:null};
  let first=lows.at(-1),second=null,shape='第一隻腳',line=null,left=null;
  const a=lows.at(-2),b=lows.at(-1);
  if(a!==undefined&&bars[b].close>=bars[a].close&&bars.slice(a+1).every(x=>x.close>=bars[a].close)){
   first=a;second=b;shape='W底';const high=Math.max(...bars.slice(a+1,b).map(x=>x.close));line=()=>high;
  }
  if(lows.length>=3){
   const l=lows.at(-3),h=lows.at(-2),r=lows.at(-1);
   if(bars[h].close<bars[l].close&&bars[h].close<bars[r].close&&Math.abs(bars[l].close/bars[r].close-1)<=.1&&bars.slice(h+1).every(x=>x.close>=bars[h].close)){
    const peak=(from,to)=>{let k=from;for(let j=from+1;j<to;j++)if(bars[j].close>bars[k].close)k=j;return k;};
    const p=peak(l+1,h),q=peak(h+1,r);
    if(q>p){first=h;second=r;left=l;shape='頭肩底';line=k=>bars[p].close+(bars[q].close-bars[p].close)*(k-p)/(q-p);}
   }
  }
  if(bars.slice(first+1).some(x=>x.close<bars[first].close))return {...base,pattern:null};
  let breakout=null;
  if(second!==null)for(let k=second+3;k<=n;k++)if(bars[k].close>line(k)&&bars[k-1].close<=line(k-1))breakout=bars[k].date;
  const neck=line?line(n):null,aboveNeck=valid(neck)&&bars[n].close>neck;
  const stage=second===null?1:aboveNeck?(base.stable?4:3):2;
  return {...base,stage,pattern:{shape,low1:bars[first].close,low2:second===null?null:bars[second].close,date1:bars[first].date,date2:second===null?null:bars[second].date,confirmed:bars[(second??first)+3].date,neck,aboveNeck,breakout,left:left===null?null:bars[left].date,invalid:bars[first].close}};
 }


 function bottomSetup(close,state){
  const p=state?.pattern;
  if(!p||![close,state.ma20,state.ma60,p.low1,p.low2].every(valid)||!(close<state.ma20))return null;
  if(close>=state.ma60&&p.low2>p.low1+1e-9)return {id:'hold60',name:'破月守季｜第二腳墊高'};
  if(close<state.ma60&&p.low2+1e-9>=p.low1)return {id:'below60',name:'月季線下｜第二腳不破底'};
  return null;
 }

 function bottomZone(bars,state){
  const p=state?.pattern,reasons=[];
  if(!p||!['W底','頭肩底'].includes(p.shape))return {ok:false,reasons:['尚未形成W底或頭肩底']};
  const first=bars.findIndex(b=>b.date===p.date1),second=bars.findIndex(b=>b.date===p.date2),t=bars.at(-1);
  const before=bars.slice(Math.max(0,first-60),first);
  if(before.length<20||second-first<5)return {ok:false,reasons:['下跌前歷史不足或兩腳間距不足5日']};
  const peak=Math.max(...before.map(b=>b.close)),drop=(1-p.low1/peak)*100,belowPeak=(1-t.close/peak)*100,rebound=(t.close/p.low1-1)*100,neckGap=(t.close/p.neck-1)*100,maGap=(t.close/state.ma20-1)*100;
  if(!(drop>15+1e-9))reasons.push('底部前跌幅未超過15%');
  if(belowPeak<10-1e-9)reasons.push('已回到下跌前高點附近');
  if(rebound>20+1e-9)reasons.push('離底部已反彈超過20%');
  if(!valid(p.neck)||neckGap>5+1e-9)reasons.push('超過頸線5%或頸線無效');
  if(maGap>8+1e-9)reasons.push('高於MA20超過8%');
  if(p.shape==='W底'&&p.low2/p.low1>1.08+1e-9)reasons.push('W底兩腳價差超過8%');
  if(p.shape==='W底'&&p.neck/Math.max(p.low1,p.low2)<1.03-1e-9)reasons.push('兩腳間反彈不足3%，底型不明確');
  if(p.shape==='頭肩底'&&p.low2/p.low1<1.03-1e-9)reasons.push('頭部與右肩差距不足3%');
  return {ok:!reasons.length,reasons,peak,drop,belowPeak,rebound,neckGap,maGap};
 }



 function entryZones(state){
  const p=state?.pattern;if(!p||!valid(p.low1)||!valid(p.invalid))return null;
  const zone=price=>valid(price)&&price>=p.invalid?{low:price,high:price*1.01}:null;
  const first=zone(p.low1),second=zone(p.low2);
  const overlap=!!first&&!!second&&Math.max(first.low,second.low)<=Math.min(first.high,second.high);
  return {first,second,overlap,firstReady:!!p.date1,secondReady:!!p.date2&&p.low2>=p.invalid,invalid:p.invalid};
 }
 function peerStrength(code,groups,states){
  return [...groups].filter(([,members])=>members.has(code)).map(([name,members])=>{
   const eligible=[...members].filter(c=>states.has(c)),strong=eligible.filter(c=>states.get(c).above&&states.get(c).rs>0);
   const others=strong.filter(c=>c!==code).length,ratio=eligible.length?strong.length/eligible.length:0;
   return {name,total:members.size,valid:eligible.length,strong:strong.length,others,passes:eligible.length>=3&&strong.length>=3&&others>=2&&ratio>=0.5};
  }).sort((a,b)=>Number(b.passes)-Number(a.passes)||b.strong/b.valid-a.strong/a.valid||b.strong-a.strong)[0]||null;
 }

 if(typeof module==='object'&&module.exports){module.exports={drawdown,relative,analyze,peerStrength,bottomZone,entryZones,bottomSetup};return;}
 const root=document.getElementById('higher-low-content'),toggle=document.getElementById('higher-low-toggle');if(!root||!toggle)return;
 const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
 const stages={2:'底部成形｜等待突破',3:'剛突破頸線',4:'剛站穩月線｜進場觀察'};
 let benchmark=null,error='',filter='all',setupFilter='all';
 toggle.addEventListener('click',()=>{root.hidden=!root.hidden;toggle.setAttribute('aria-expanded',String(!root.hidden));toggle.textContent=root.hidden?'展開落底名單 ▾':'收合落底名單 ▴';if(!root.hidden)render();});


 function entryHtml(x){
  const e=entryZones(x);if(!e)return '資料不足，暫無位置';
  const range=z=>z?'約 '+fmt(z.low)+'～'+fmt(z.high)+' 元':'尚未確立';
  const status=(ready,z)=>!ready||!z?'等待腳位確認':x.stock.t.close>z.high?'已離區，不追價':x.stock.t.close>=z.low?'回到腳位區，觀察收盤守穩':'已跌回腳位下方，暫停分批';
  return '<strong style="color:#ffe298">① 第一腳確立：第一批觀察</strong><small>'+range(e.first)+'</small><small>'+status(e.firstReady,e.first)+'</small><strong style="color:#ffb36e">② 第二腳確立：第二批觀察</strong><small>'+range(e.second)+'</small><small>'+status(e.secondReady,e.second)+'</small>'+(e.overlap?'<small>兩腳價區重疊，須分不同確認時點觀察</small>':'')+'<small>③ 突破頸線 '+fmt(x.pattern.neck)+'：'+(x.pattern.aboveNeck?'底型確認':'等待收盤突破')+'</small><small>④ 站穩月線：'+(x.stable&&x.pattern.aboveNeck?'轉強確認':'等待頸線突破且連2日站上MA20')+'</small><small style="color:#ffb36e">收盤跌破 '+fmt(e.invalid)+' 元撤銷底型，重新找腳</small>';
 }
 function render(){
  if(typeof analyses==='undefined'||!analyses.length){root.textContent='等待個股日線資料…';return;}
  if(!benchmark){root.textContent=error||'正在載入大盤歷史…';return;}
  if(mode!=='live'){root.textContent='請先載入正式盤後行情。';return;}
  const date=analyses.map(s=>s.t.date).sort().at(-1),market=benchmark.filter(x=>x.d<=date&&valid(x.i)).sort((a,b)=>a.d.localeCompare(b.d)),marketFall=market.at(-1)?.d===date?drawdown(market.slice(-60).map(x=>x.i)):null;
  const states=new Map();for(const stock of analyses){const state=analyze(stock.bars,market,date);if(state)states.set(stock.code,state);}
  const groups=window.getHotSectorGroups?.()||new Map(),items=[];
  for(const stock of analyses){const s=states.get(stock.code);if(!s?.pattern||!(s.fall>15+1e-9)||stock.t.close<20||stock.t.volume<=500)continue;const setup=bottomSetup(stock.t.close,s);if(!setup)continue;const zone=bottomZone(stock.bars,s);if(!zone.ok)continue;const peer=peerStrength(stock.code,groups,states);items.push({stock,...s,zone,peer,setup,sectorBonus:peer?.passes?10:0});}
  const counts=k=>items.filter(x=>x.stage===k).length;
  const selected=items.filter(x=>(filter==='all'||x.stage===Number(filter))&&(setupFilter==='all'||x.setup.id===setupFilter)).sort((a,b)=>(b.stock.score??-1)-(a.stock.score??-1)||b.sectorBonus-a.sectorBonus||a.stock.code.localeCompare(b.stock.code));
  root.innerHTML='<p><strong>月線下兩類築底，排除已大幅拉升</strong> · 行情 '+esc(date)+' · 大盤60日最大回落 '+fmt(marketFall)+'%（輔助資訊，不阻擋個股）</p><p>破月守季 '+items.filter(x=>x.setup.id==='hold60').length+' 檔 · 月季線下 '+items.filter(x=>x.setup.id==='below60').length+' 檔；底部成形 '+counts(2)+' 檔、頸線突破 '+counts(3)+' 檔。兩類都還在月線下，屬築底分批觀察；站回月線即離開本名單，不追已發動個股。</p><label class="field">觀察階段<select id="higher-low-stage">'+[['all','全部階段'],...Object.entries(stages).filter(([k])=>k!=='4')].map(([k,v])=>'<option value="'+k+'" '+(filter===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label><label class="field">築底類型<select id="higher-low-setup">'+[['all','兩類都看'],['hold60','破月守季｜第二腳墊高'],['below60','月季線下｜第二腳不破底']].map(([k,v])=>'<option value="'+k+'" '+(setupFilter===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label><details><summary>兩類築底與失效條件</summary><p>最新收盤判斷：第一類收盤＜MA20且≥MA60，第二腳嚴格高於第一腳；第二類收盤＜MA20且＜MA60，第二腳不低於第一腳（允許同價）。MA20／MA60均含最新日線；等於MA20不納入，等於MA60視為守住季線。這是目前所處位置，不限定今天首次跌破。兩類仍在月線下，只列築底與頸線觀察，不直接判定已站穩月線；日後站回月線便離開這兩類名單。頭肩底的第一、二腳沿用頭部與右肩。</p><p>僅保留W底或頭肩底，不列單一低點。新增防追高條件：第一腳／頭部之前60日內最高收盤至底部跌幅＞15%；目前仍比該高點低至少10%；距第一腳／頭部反彈≤20%；收盤不得高於頸線5%、高於MA20不得超過8%。兩腳間隔至少5日，W底兩腳差≤8%、兩腳間反彈至少3%；頭肩底右肩比頭部高至少3%。上述數字為本版量化設定，底型仍需人工核對。</p><p>① 第一隻腳：近60日內的收盤轉折低點，左右各3個交易日確認。② 第二隻腳：後一個已確認低點不低於第一腳；同價允許，不再強制墊高1%。③ 突破頸線：W底採兩底之間最高收盤；頭肩底採左右反彈高點連線，最新收盤須在頸線上。④ 站穩月線：完成第三步，並連續2個交易日收盤＞各日MA20，列進場觀察。收盤跌回頸線下即退回第二階段；跌回MA20下則退回頸線突破階段。</p><p>第一腳收盤低點為失效線，收盤跌破就撤銷原底部，重新找新腳。頭肩底採最近三個已確認低點，中間最低、左右肩差異≤10%為本版量化設定，失效線採頭部低點。頸線與月線條件可先後發生，但須目前同時成立。維持個股60日回落＞15%、股價≥20元、當日量＞500張。RS5為輔助標記；族群同步轉強另加10分：同細分族群至少3檔且半數以上同時收盤＞MA20、RS5＞0，扣除本股後至少2檔符合。多重歸屬取優先符合者，不重複加分；資料不足不加分。族群加分不改動均線15分、不放寬底部與防追高條件。均線含當日，全程只用已完成日線，沿用收盤判斷標準，不使用未來資料。</p><p>依圖分批：第一腳確認後為第一批觀察，第二腳確認且未破第一腳為第二批；頸線突破、站穩月線分別為後續底型與轉強確認，不另預設第三、四批。每腳參考區暫以該收盤腳位至上方1%量化，圖片未指定此幅度；腳位須左右各3日確認，不能事後假設成交在最低點。現在已離區就標示不追價。兩區重疊須分不同確認時點觀察；收盤跌破失效線即撤銷底型，不自動攤平。頭肩底以頭部及右肩對應，頭部為失效線。價區為觀察參考，不保證成交或獲利。</p></details><p>'+selected.length+' 檔 · 均線分數由高到低，同分時族群加分優先</p><div class="chipburst-table-wrap"><table class="chipburst-table"><thead><tr><th>個股／階段</th><th>收盤／均線</th><th>底部／兩腳</th><th>頸線</th><th>月線／季線位置</th><th>分批進場觀察位置</th><th>失效線／底部位置</th><th>族群加分／輔助訊號</th></tr></thead><tbody>'+selected.map(x=>'<tr><td><button data-higher-low="'+esc(x.stock.code)+'">'+esc(x.stock.name)+' '+esc(x.stock.code)+'</button><small style="color:'+(x.stage===4?'#ffb36e':'#dce6ee')+'">'+stages[x.stage]+'</small><small style="color:#ffe298">'+x.setup.name+'</small></td><td>'+fmt(x.stock.t.close)+'<small style="color:#ffb36e">均線 '+(x.stock.score==null?'待補':x.stock.score+' / 15')+'</small><small>60日回落 '+fmt(x.fall)+'%</small></td><td>'+x.pattern.shape+'<small>第一腳 '+fmt(x.pattern.low1)+'（'+esc(x.pattern.date1)+'）</small><small>第二腳 '+fmt(x.pattern.low2)+'（'+esc(x.pattern.date2)+'）</small><small>確認日 '+esc(x.pattern.confirmed)+'</small></td><td>'+fmt(x.pattern.neck)+'<small>'+(x.pattern.aboveNeck?'收盤已突破':'等待突破')+'</small></td><td>MA20 '+fmt(x.ma20)+'<small>MA60 '+fmt(x.ma60)+'</small><small>'+(x.stock.t.close>=x.ma60?'守住季線':'低於季線')+'</small><small>'+(x.stable?'連2日站上':x.above?'今日站上，待站穩':'尚未站上')+'</small></td><td style="min-width:210px;white-space:normal">'+entryHtml(x)+'</td><td style="color:#ffb36e">'+fmt(x.pattern.invalid)+'<small>收盤跌破撤銷</small><small>離底 +'+fmt(x.zone.rebound)+'%</small><small>距頸線 '+fmt(x.zone.neckGap)+'% · 月線 '+fmt(x.zone.maGap)+'%</small><small>距下跌前高點 −'+fmt(x.zone.belowPeak)+'%</small></td><td><strong style="color:#ffb36e">族群加分 +'+x.sectorBonus+' / 10</strong><small>'+(x.sectorBonus?'同族群同步轉強':'尚未符合族群共振')+'</small>RS5 '+fmt(x.rs)+'%<small>'+(x.rs>0?'近5日強於大盤':'RS未轉強／待補')+'</small><small>'+(x.peer?esc(x.peer.name)+' '+x.peer.strong+'/'+x.peer.valid+' 檔同步轉強'+(x.peer.passes?' ✓':''):'族群待補')+'</small>'+(marketFall>15?'大跌後觀察':'個股先觀察')+'</td></tr>').join('')+'</tbody></table></div>'+(selected.length?'':'<p>此階段尚無符合個股，可切換其他階段觀察。</p>');
  root.querySelector('#higher-low-stage').addEventListener('change',e=>{filter=e.target.value;render();});
  root.querySelector('#higher-low-setup').addEventListener('change',e=>{setupFilter=e.target.value;render();});
  root.querySelectorAll('[data-higher-low]').forEach(b=>b.onclick=()=>{const stock=analyses.find(s=>s.code===b.dataset.higherLow);if(stock)openStockDetail(stock,b);});
 }
 window.addEventListener('stock-data-ready',()=>{if(!root.hidden)render();});
 fetch('taiwan-sentiment-data.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('大盤資料讀取失敗');return r.json();}).then(d=>{if(!Array.isArray(d.rows))throw Error('大盤資料格式錯誤');benchmark=d.rows;render();}).catch(e=>{error=e.message;render();});
})();

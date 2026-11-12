// Closing-price structure candidates. Candle geometry remains in the separate OHLC rules.
function structurePatterns(bars){
 const wedge=fallingWedgePattern(bars);
 const result={headShoulders:false,triangle:false,vcp:false,fallingWedge:!!wedge,notes:wedge?{fallingWedge:wedge.note}:{}};
 const a=bars.slice(-100),n=a.length,t=a[n-1];
 if(n<40||a.some(b=>![b.high,b.low,b.close,b.volume].every(Number.isFinite)||b.low<=0||b.high<b.low))return result;
 const mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
 const pivots=[];
 for(let i=3;i<n-3;i++){
  const neighbors=a.slice(i-3,i).concat(a.slice(i+1,i+4));
  const hi=neighbors.every(b=>a[i].close>b.close),lo=neighbors.every(b=>a[i].close<b.close);
  if(hi===lo)continue;
  const p={i,type:hi?'H':'L',price:a[i].close};
  const last=pivots.at(-1);
  if(last?.type===p.type){if(p.type==='H'?p.price>last.price:p.price<last.price)pivots[pivots.length-1]=p;}
  else pivots.push(p);
 }
 for(let k=pivots.length-5;k>=0;k--){
  const [l,x,h,y,r]=pivots.slice(k,k+5);
  if([l.type,x.type,h.type,y.type,r.type].join('')!=='LHLHL'||r.i-l.i<20||n-1-r.i>15)continue;
  const neck=x.price+(y.price-x.price)*(n-1-x.i)/(y.i-x.i);
  const balanced=Math.abs(l.price/r.price-1)<=.08&&(h.i-l.i)/(r.i-h.i)>=.5&&(h.i-l.i)/(r.i-h.i)<=2;
  const preceding=a.slice(Math.max(0,l.i-15),l.i);
  if(balanced&&preceding.length>=5&&Math.max(...preceding.map(b=>b.close))>=l.price*1.08&&h.price<=Math.min(l.price,r.price)*.97&&Math.min(x.price,y.price)>=Math.max(l.price,r.price)*1.04&&Math.abs(x.price/y.price-1)<=.1&&t.close>=neck*.97&&t.close<=neck*1.05&&t.close>r.price){
   result.headShoulders=true;result.notes.headShoulders=`左肩 ${l.price.toFixed(2)}／頭 ${h.price.toFixed(2)}／右肩 ${r.price.toFixed(2)}；目前頸線 ${neck.toFixed(2)}，${t.close>=neck?'收盤站上頸線':'接近頸線，尚未突破'}。`;break;
  }
 }
 const fit=ps=>{const mx=mean(ps.map(p=>p.i)),my=mean(ps.map(p=>p.price));const den=ps.reduce((s,p)=>s+(p.i-mx)**2,0);const slope=ps.reduce((s,p)=>s+(p.i-mx)*(p.price-my),0)/den;return {slope,at:i=>my+slope*(i-mx)};};
 const recent=pivots.filter(p=>p.i>=n-60),hs=recent.filter(p=>p.type==='H').slice(-3),ls=recent.filter(p=>p.type==='L').slice(-3);
 if(hs.length===3&&ls.length===3){
  const u=fit(hs),d=fit(ls),start=Math.min(hs[0].i,ls[0].i),upper=u.at(n-1),lower=d.at(n-1),initial=u.at(start)-d.at(start),width=upper-lower;
  const touches=hs.every(p=>Math.abs(p.price/u.at(p.i)-1)<=.025)&&ls.every(p=>Math.abs(p.price/d.at(p.i)-1)<=.025);
  if(n-1-start>=20&&n-1-Math.max(hs.at(-1).i,ls.at(-1).i)<=12&&((u.slope<-.0005*t.close&&d.slope>.0005*t.close)||(Math.abs(u.slope)<=.0005*t.close&&d.slope>.0005*t.close)||(u.slope<-.0005*t.close&&Math.abs(d.slope)<=.0005*t.close))&&initial>0&&width>0&&width<=initial*.65&&width/t.close>=.01&&touches&&t.close>=lower*.98&&t.close<=upper*1.02){result.triangle=true;result.notes.triangle=`上緣 ${upper.toFixed(2)}／下緣 ${lower.toFixed(2)}；${Math.abs(u.slope)<=.0005*t.close?'上升三角':Math.abs(d.slope)<=.0005*t.close?'下降三角':'對稱三角'}；區間寬度縮至初期 ${(width/initial*100).toFixed(1)}%，上下緣各 3 個轉折點；${t.close>upper?(t.close>t.open&&(t.close-t.open)/t.open>=.03?'長紅突破上緣':'收盤站上上緣，未達長紅門檻'):'尚未突破上緣'}。`;}
 }
 const swings=[];
 for(let k=0;k<pivots.length-1;k++){const h=pivots[k],l=pivots[k+1];if(h.type==='H'&&l.type==='L'&&h.i>=n-65&&l.i-h.i>=3)swings.push({h,l,depth:(h.price-l.price)/h.price,volume:mean(a.slice(h.i,l.i+1).map(b=>b.volume))});}
 const contractions=swings.slice(-2),m20=mean(a.slice(-20).map(b=>b.close)),m40=mean(a.slice(-40).map(b=>b.close)),v5=mean(a.slice(-5).map(b=>b.volume)),v20=mean(a.slice(-20).map(b=>b.volume));
 if(contractions.length===2){const [x,z]=contractions,pivot=Math.max(...contractions.map(s=>s.h.price));const tight=a.slice(-5);const tightRange=(Math.max(...tight.map(b=>b.close))-Math.min(...tight.map(b=>b.close)))/t.close;
  if(x.l.i-x.h.i>=8&&z.h.i-x.l.i>=8&&x.h.i>=10&&a[x.h.i].close>=a[x.h.i-10].close*1.05&&x.depth>=.08&&x.depth<=.35&&z.depth<=x.depth*.8&&z.depth>=.01&&z.depth<=.08&&z.volume<=x.volume&&v20>0&&v5<=v20*.75&&m20>m40&&t.close>=m20&&n-1-z.l.i<=12&&t.close>=pivot*.9&&t.close<=pivot*1.03&&tightRange<=.06){result.vcp=true;result.notes.vcp=`大圓底／小圓底回檔 ${(x.depth*100).toFixed(1)}% → ${(z.depth*100).toFixed(1)}%；近5日／20日均量 ${(v5/v20).toFixed(2)}，樞紐 ${pivot.toFixed(2)}；${t.close>=pivot?'收盤站上頸線':'尚未突破頸線'}。`;}
 }
 return result;
}

function fallingWedgePattern(bars){
 const a=bars.slice(-120),n=a.length;
 if(n<120||a.some(b=>![b.high,b.low,b.close].every(Number.isFinite)||b.low<=0||b.high<b.low||b.close<b.low||b.close>b.high))return null;
 // Major confirmed extrema, including the left edge of the collection window.
 const highs=[],lows=[];
 for(let i=0;i<n-3;i++){
  const before=a.slice(Math.max(0,i-5),i),after=a.slice(i+1,i+4);
  if(before.concat(after).every(b=>a[i].high>b.high))highs.push({i,price:a[i].high});
  if(before.concat(after).every(b=>a[i].low<b.low))lows.push({i,price:a[i].low});
 }
 const lines=(ps,side)=>{
  const out=[];
  for(let j=0;j<ps.length;j++)for(let k=j+1;k<ps.length;k++){
   const p=ps[j],q=ps[k],span=q.i-p.i;
   if(span<10||q.price>=p.price||n-1-q.i>45)continue;
   const m=(q.price-p.price)/span,at=i=>p.price+m*(i-p.i);
   if(at(n-1)<=0)continue;
   const section=a.slice(p.i),inside=section.filter((b,x)=>side==='upper'?b.close<=at(p.i+x)*1.04:b.close>=at(p.i+x)*.96).length/section.length;
   if(inside<.85)continue;
   const touches=ps.filter(t=>t.i>=p.i&&Math.abs(t.price/at(t.i)-1)<=.04).length;
   out.push({m,at,start:p.i,end:q.i,touches,quality:inside+span/120+touches*.05});
  }
  return out.sort((x,y)=>y.quality-x.quality).slice(0,16);
 };
 const us=lines(highs,'upper'),ds=lines(lows,'lower'),candidates=[];
 for(const u of us)for(const d of ds){
  const first=Math.max(u.start,d.start),duration=n-first;
  if(duration<20||duration>120||!(u.m<d.m&&d.m<0))continue;
  const upper=u.at(n-1),lower=d.at(n-1),initial=u.at(first)-d.at(first),width=upper-lower,close=a.at(-1).close;
  if(!(lower>0&&initial>0&&width>0&&width<=initial*.8&&width/close>=.01))continue;
  const position=(close-lower)/width;
  if(position<.2-1e-9||position>1+1e-9)continue;
  const section=a.slice(first),wickInside=section.filter((b,x)=>b.high<=u.at(first+x)*1.06&&b.low>=d.at(first+x)*.94).length/section.length;
  const closeInside=section.filter((b,x)=>b.close<=u.at(first+x)*1.04&&b.close>=d.at(first+x)*.96).length/section.length;
  if(wickInside<.75||closeInside<.85)continue;
  // A brief historical pierce is allowed, persistent or extreme support failure is not.
  if(section.some((b,x)=>b.close<d.at(first+x)*.9))continue;
  let streak=0,failed=false;for(let x=0;x<section.length;x++){streak=section[x].close<d.at(first+x)*.96?streak+1:0;if(streak>2){failed=true;break;}}
  if(failed)continue;
  const state='楔形整理中',completeness=u.touches>=3&&d.touches>=3?'較完整':'初步候選';
  candidates.push({state,upper,lower,position,duration,quality:closeInside+wickInside+duration/120,
   note:`近120交易日偵測，主要波段連線，重疊期間 ${duration} 日；上緣 ${upper.toFixed(2)}／下緣 ${lower.toFixed(2)}；收斂 ${((1-width/initial)*100).toFixed(1)}%；收盤位置 ${(position*100).toFixed(1)}%（下緣0%、上緣100%）；${state}／${completeness}。高低點含影線、左側5日、右側3日確認；容許少量短暫穿線，非突破或買進保證。`});
 }
 return candidates.sort((x,y)=>y.quality-x.quality)[0]||null;
}

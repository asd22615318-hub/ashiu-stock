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
 // Require the latest close strictly below the 240-session annual SMA.
 const annual=bars.slice(-240);
 if(annual.length<240||annual.some(b=>!Number.isFinite(b.close)||b.close<=0))return null;
 const ma240=annual.reduce((sum,b)=>sum+b.close,0)/240;
 if(!(bars.at(-1).close<ma240))return null;
 // Past confirmed closing-price pivots only; a 120-session collection window.
 const a=bars.slice(-120),n=a.length;
 if(n<120||a.some(b=>!Number.isFinite(b.close)||b.close<=0))return null;
 const ps=[];
 for(let i=3;i<n-3;i++){
  const near=a.slice(i-3,i).concat(a.slice(i+1,i+4));
  const h=near.every(b=>a[i].close>b.close),l=near.every(b=>a[i].close<b.close);
  if(h===l)continue;
  const p={i,price:a[i].close,type:h?'H':'L'},last=ps.at(-1);
  if(last?.type===p.type){if(h?p.price>last.price:p.price<last.price)ps[ps.length-1]=p;}else ps.push(p);
 }
 const fit=points=>{
  const x=points.reduce((s,p)=>s+p.i,0)/points.length,y=points.reduce((s,p)=>s+p.price,0)/points.length;
  const m=points.reduce((s,p)=>s+(p.i-x)*(p.price-y),0)/points.reduce((s,p)=>s+(p.i-x)**2,0);
  return {m,at:i=>y+m*(i-x)};
 };
 for(let k=0;k<=ps.length-6;k++){
  const seq=ps.slice(k),hs=seq.filter(p=>p.type==='H'),ls=seq.filter(p=>p.type==='L');
  if(hs.length<3||ls.length<3)continue;
  const start=seq[0].i,last=seq.at(-1).i;
  if(n-1-start<30||n-1-last>15)continue;
  if(!hs.every((p,i)=>!i||p.price<hs[i-1].price)||!ls.every((p,i)=>!i||p.price<ls[i-1].price))continue;
  const u=fit(hs),d=fit(ls),upper=u.at(n-1),lower=d.at(n-1),initial=u.at(start)-d.at(start),width=upper-lower,close=a.at(-1).close;
  if(!(u.m<d.m&&d.m<0&&lower>0&&initial>0&&width>0&&width<=initial*.7&&width/close>=.01))continue;
  if(!hs.every(p=>Math.abs(p.price/u.at(p.i)-1)<=.025)||!ls.every(p=>Math.abs(p.price/d.at(p.i)-1)<=.025))continue;
  const contained=a.slice(start).filter((b,j)=>b.close>=d.at(start+j)*.98&&b.close<=u.at(start+j)*1.02).length/(n-start);
  if(contained<.8||close<lower*.98||close>upper*1.05)continue;
  const state=close>upper?'收盤突破上緣':'楔形整理中';
  return {state,upper,lower,note:`收盤低於年線 MA240（${ma240.toFixed(2)}）；近120交易日偵測，楔形跨度 ${n-start} 日；上緣 ${upper.toFixed(2)}／下緣 ${lower.toFixed(2)}；寬度縮至初期 ${(width/initial*100).toFixed(1)}%；${state}。轉折以收盤價、左右各3日確認，屬自動候選。`};
 }
 return null;
}

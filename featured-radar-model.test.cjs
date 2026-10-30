const assert=require('node:assert/strict'),model=require('./featured-radar-model.js');
function fixture(){
 const dates=[];for(let d=new Date('2026-06-01T00:00:00Z');dates.length<90;d.setUTCDate(d.getUTCDate()+1))if(d.getUTCDay()%6)dates.push(d.toISOString().slice(0,10));
 const bars=dates.map((date,i)=>{const close=50+i*.01;return {date,open:close+.1,high:close+.3,low:close-.3,close,volume:2000,amount:close*2000000};});
 const stock={code:'9991',name:'測試',market:'上市',bars},date=dates.at(-1);
 const ctx={date,ownership:{weeks:[79,84,89].map((i,j)=>({date:dates[i],stocks:{9991:{400:20+j*.6}}}))},broker:{periods:[]},daily:{sessions:[{date,stocks:{9991:{date,unit:'lots',top_n:15,buy_lots:100,sell_lots:50,net_lots:50}}}]},benchmark:{rows:dates.map(d=>({d,i:10000}))},regulatory:{quote_date:date,stocks:{}},sectors:new Map([['9991',{name:'測試族群',rank:1}]]),maScores:new Map([['9991',10]])};
 return {stock,ctx};
}
function bFixture(){
 const f=fixture();f.stock.bars.forEach(b=>Object.assign(b,{open:50,high:50.3,low:49.7,close:50,volume:2000,amount:100000000}));
 Object.assign(f.stock.bars.at(-1),{open:61,high:61.3,low:59.7,close:60,volume:6000,amount:360000000});return f;
}
function cFixture(trigger){
 const f=fixture(),b=f.stock.bars;b.forEach(x=>Object.assign(x,{open:50.1,high:50.3,low:49.7,close:50,volume:2000,amount:100000000}));
 for(let i=59;i<=79;i++){const close=48+(i-59)*.6;Object.assign(b[i],{open:close+.1,high:close+.3,low:close-.3,close,volume:3000,amount:close*3000000});}
 [59,58,57,56,55,55,55.4,55.7,56].forEach((close,j)=>Object.assign(b[80+j],{open:close+.1,high:close+.3,low:close-.3,close,volume:900,amount:close*900000}));
 const close=trigger?59.5:55.5;Object.assign(b.at(-1),{open:close+.2,high:close+.3,low:close-.3,close,volume:trigger?4000:900,amount:close*(trigger?4000000:900000)});
 return f;
}
if(require.main===module){
 let f=fixture();f.stock.bars.slice(-5).forEach(b=>{b.volume=1000;b.amount=b.close*1000000;});let r=model.evaluate(f.stock,f.ctx).radars.find(r=>r.type==='A');assert(r);assert.equal(r.score.total,80);assert.equal(r.score.pending,20);assert(r.priority);
 const held=model.holdings(f.ctx,'9991',f.ctx.date);assert(held.increasing);assert.equal(held.totalChange,1.2);
 f=bFixture();r=model.evaluate(f.stock,f.ctx).radars.find(r=>r.type==='B');assert(r);assert.equal(r.score.total,100);assert(r.priority);assert(f.stock.bars.at(-1).close<f.stock.bars.at(-1).open);
 f=cFixture(false);r=model.evaluate(f.stock,f.ctx).radars.find(r=>r.type==='C');assert(r);assert(!r.trigger);assert(r.state.startsWith('SETUP'));
 f=cFixture(true);r=model.evaluate(f.stock,f.ctx).radars.find(r=>r.type==='C');assert(r?.trigger);assert(r.state.startsWith('TRIGGERED'));assert.equal(r.score.items.find(x=>x.name==='再攻確認').pass,true);
 f=cFixture(false);f.stock.bars.at(-1).close=54;f.stock.bars.at(-1).low=53.7;assert(!model.evaluate(f.stock,f.ctx).radars.some(r=>r.type==='C'));
 f=bFixture();f.stock.bars.at(-1).amount=null;assert(!model.evaluate(f.stock,f.ctx).gate.ok);
 f=bFixture();f.ctx.regulatory.stocks['9991']={disposals:[{start:f.ctx.date,end:f.ctx.date}]};assert(!model.evaluate(f.stock,f.ctx).gate.ok);
 f=bFixture();f.ctx.ownership=null;r=model.evaluate(f.stock,f.ctx).radars.find(r=>r.type==='B');assert.equal(r.score.items.find(x=>x.name==='籌碼確認').pass,null);
 f=fixture();f.stock.bars.at(-1).amount=null;const old=f.stock.bars.at(-1),supp={dates:{[old.date]:{'上市':{'9991':old.close*old.volume*1000}}}},enriched=model.withTradeValues(f.stock,supp);assert(Number.isFinite(enriched.bars.at(-1).amount));assert.equal(f.stock.bars.at(-1).amount,null);
 f=bFixture();f.ctx.ownership.weeks.at(-1).date='2099-01-01';assert.notEqual(model.holdings(f.ctx,'9991',f.ctx.date).date,'2099-01-01');
 console.log('A/B/C formulas, score weights, black breakout, setup/trigger separation, real amounts, exclusions and missing data passed.');
}
module.exports={fixture,bFixture,cFixture};
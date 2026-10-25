const assert=require('node:assert/strict');
const search=require('./ownership-strength-model.js'),burst=require('./chipburst-radar.js');
function fixture(n=3){
 const dates=['2026-10-19','2026-10-20'],stocks=Array.from({length:n},(_,i)=>({code:String(1000+i),bars:dates.map(date=>({date,volume:600}))}));
 const ownership={weeks:[{date:'2026-10-16',stocks:Object.fromEntries(stocks.map(s=>[s.code,{'400':30}]))},{date:'2026-10-20',stocks:Object.fromEntries(stocks.map((s,i)=>[s.code,{'400':31+i/100}]))}]};
 const institutional={report_dates:dates,stocks:Object.fromEntries(stocks.map((s,i)=>[s.code,{daily_history:dates.map(date=>({date,total:i+1}))}]))};
 const broker={periods:[{start:dates[0],end:dates[1],dates,stocks:Object.fromEntries(stocks.map((s,i)=>[s.code,{start:dates[0],end:dates[1],unit:'lots',top_n:15,buyers:Array(15).fill({}),sellers:Array(15).fill({}),buy_lots:i+2,sell_lots:1,net_lots:i+1}]))}]};
 return {stocks,ownership,institutional,broker};
}
const run=f=>search.calculate(f.stocks,f.ownership,f.institutional,'2026-10-20',f.broker);
let f=fixture(),r=run(f);assert.equal(r.rows.get('1000').score,0);assert.equal(r.rows.get('1001').score,50);assert.equal(r.rows.get('1002').score,100);
f=fixture(40);r=run(f);const ranked=burst.calculate(f.stocks,f.ownership,f.institutional,'2026-10-20',f.broker);assert.equal(ranked.rows.length,30);assert.equal(ranked.scoredRows.length,40);for(const row of ranked.scoredRows)assert.equal(r.rows.get(row.code).score,row.score);
f=fixture();f.broker=null;r=run(f);assert.equal(r.rows.get('1000').score,null);assert.equal(r.rows.get('1000').holderNow,31);assert.equal(r.rows.get('1000').institutionalNet,2);
f=fixture();f.ownership.weeks[0].invalid_stocks={'1000':'invalid'};r=run(f);assert.equal(r.rows.get('1000').score,null);assert.equal(r.rows.get('1000').holderNow,31);assert.equal(r.rows.get('1000').institutionalNet,2);
f=fixture();f.ownership.weeks[1].stocks['1000']['400']=29;assert.equal(run(f).rows.get('1000').score,null);
f=fixture();f.institutional.stocks['1000'].daily_history[0].total=-5;assert.equal(run(f).rows.get('1000').score,null);
f=fixture();f.broker.periods[0].stocks['1000'].net_lots=99;assert.equal(run(f).rows.get('1000').score,null);
console.log('Shared chipburst scores match; beyond-top-30, eligibility, missing branches and independent raw data verified.');

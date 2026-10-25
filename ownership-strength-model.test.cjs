const assert=require('node:assert/strict');
const {calculate,percentiles}=require('./ownership-strength-model.js');
function fixture(){
 const dates=['2026-10-19','2026-10-20'],stocks=['a','b','c'].map(code=>({code,bars:dates.map(date=>({date,volume:100}))}));
 const ownership={weeks:[{date:'2026-10-16',stocks:Object.fromEntries(stocks.map(s=>[s.code,{'400':30}]))},{date:'2026-10-20',stocks:{a:{'400':29},b:{'400':30},c:{'400':31}}}]};
 const institutional={report_dates:dates,stocks:Object.fromEntries(stocks.map((s,i)=>[s.code,{daily_history:dates.map(date=>({date,total:(i-1)*10}))}]))};
 const broker={periods:[{start:dates[0],end:dates[1],dates,stocks:Object.fromEntries(stocks.map((s,i)=>[s.code,{start:dates[0],end:dates[1],unit:'lots',top_n:15,buyers:Array(15).fill({}),sellers:Array(15).fill({}),buy_lots:i*10,sell_lots:10,net_lots:i*10-10}]))}]};
 return {stocks,ownership,institutional,broker};
}
const run=f=>calculate(f.stocks,f.ownership,f.institutional,'2026-10-20');
let f=fixture(),r=run(f);assert.equal(r.complete,3);assert.equal(r.rows.get('a').score,0);assert.equal(r.rows.get('b').score,50);assert.equal(r.rows.get('c').score,100);
assert.equal(percentiles([{code:'a',v:1},{code:'b',v:1},{code:'c',v:3}],'v').get('a'),25);
f=fixture();f.institutional.report_dates.pop();assert.equal(run(f).complete,0);
f=fixture();delete f.broker;assert.equal(run(f).complete,3);
f=fixture();f.ownership.weeks[1].invalid_stocks={a:'bad'};assert.equal(run(f).rows.get('a').score,null);
f=fixture();f.ownership.weeks[1].stocks.a['400']=101;assert.equal(run(f).rows.get('a').score,null);

f=fixture();delete f.institutional.stocks.a.daily_history[0];assert.equal(run(f).rows.get('a').score,null);
console.log('Ownership strength: ranking, ties, negative flows, date coverage, invalid holdings and no broker dependency passed.');
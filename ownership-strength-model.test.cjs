const assert=require('node:assert/strict'),model=require('./ownership-strength-model.js');
const dates=['2026-10-19','2026-10-20'],stocks=['a','b','c'].map(code=>({code,bars:dates.map(date=>({date,volume:100}))}));
const ownership={weeks:[{date:'2026-10-16',stocks:{a:{400:30,1000:20},b:{400:30,1000:20},c:{400:30,1000:20}}},{date:'2026-10-20',stocks:{a:{400:29,1000:19},b:{400:30,1000:20},c:{400:31,1000:21}}}]};
const institutional={report_dates:dates,stocks:Object.fromEntries(stocks.map((s,i)=>[s.code,{daily_history:dates.map(date=>({date,total:(i-1)*10}))}]))};
const run=()=>model.calculate(stocks,ownership,institutional,'2026-10-20');
let r=run();assert.equal(r.complete,3);assert.equal(r.rows.get('a').score,0);assert.equal(r.rows.get('b').score,50);assert.equal(r.rows.get('c').score,100);assert.equal(r.rows.get('c').holder1000Delta,1);assert.equal(r.rows.get('a').holder1000Now,19);assert(!('brokerRatio' in r.rows.get('a')));
ownership.weeks[0].invalid_stocks={a:'invalid'};r=run();assert.equal(r.rows.get('a').score,null);assert.equal(r.rows.get('a').holderNow,29);assert.equal(r.rows.get('a').holder1000Now,19);assert.equal(r.rows.get('a').holder1000Delta,null);assert.equal(r.rows.get('a').institutionalNet,-20);
console.log('400/1000 holdings and two-factor scores verified without broker dependency.');

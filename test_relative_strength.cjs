const assert=require('node:assert/strict');
const {calculate}=require('./relative-strength.js');
const market=Array.from({length:21},(_,i)=>({d:`2026-10-${String(i+1).padStart(2,'0')}`,i:100}));
const bars=market.map(r=>({date:r.d,close:100}));
bars[20].close=118;assert.equal(calculate(bars,market).passes,true);
bars[20].close=108;assert.equal(calculate(bars,market).passes,false);
bars[20].close=108.01;assert.equal(calculate(bars,market).passes,true);
bars[15].close=108.01;assert.equal(calculate(bars,market).passes,false);
assert.equal(calculate(bars.slice(1),market),null);
assert.equal(calculate(bars,market,'2026-10-22'),null);
assert.equal(calculate(bars.slice(0,20),market),null);
market[20].i=105;bars[15].close=100;bars[20].close=118;
assert.ok(Math.abs(calculate(bars,market).rs20-13)<1e-9);
assert.equal(calculate(bars,[...market].reverse()).passes,true);
const fs=require('fs'),zlib=require('zlib');
const seed=JSON.parse(zlib.gunzipSync(fs.readFileSync('./seed.json.gz')));
console.log('snapshot keys',Object.keys(seed));
const stocks=seed.stocks,data=JSON.parse(fs.readFileSync('./taiwan-sentiment-seed.json')).rows;
if(Array.isArray(stocks)){
const date=stocks.map(s=>s.bars.at(-1)?.date).sort().at(-1);
const results=stocks.map(s=>({code:s.code,rs:calculate(s.bars,data,date)}));
console.log({date,evaluable:results.filter(x=>x.rs).length,passing:results.filter(x=>x.rs?.passes).length,examples:results.filter(x=>x.rs?.passes).slice(0,3)});
}
console.log('RS thresholds, dates, missing data, benchmark subtraction: passed');

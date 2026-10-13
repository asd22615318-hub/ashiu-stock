const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('function valuationMetric('),end=source.indexOf('function valuationHtml(',start);
assert(start>=0&&end>start);
const {valuationAssessment}=vm.runInNewContext(source.slice(start,end)+';({valuationAssessment})');
const make=(industry,metric,value)=>{
 const date='2026-10-12',universe=[],stocks={};
 for(let i=0;i<12;i++){const code=String(1000+i);universe.push({code,industry,t:{date}});stocks[code]={date,pe:20,pb:2};}
 const stock=universe[0];stocks[stock.code][metric]=value;
 return {stock,universe,snapshot:{stocks}};
};
let x=make('半導體業','pe',14);
assert.equal(valuationAssessment(x.stock,x.snapshot,x.universe).level,'便宜');
x.snapshot.stocks[x.stock.code].pe=20;
assert.equal(valuationAssessment(x.stock,x.snapshot,x.universe).level,'合理價');
x.snapshot.stocks[x.stock.code].pe=27;
assert.equal(valuationAssessment(x.stock,x.snapshot,x.universe).level,'昂貴');
x=make('金融保險業','pb',1.4);
assert.equal(valuationAssessment(x.stock,x.snapshot,x.universe).metric,'pb');
assert.equal(valuationAssessment(x.stock,x.snapshot,x.universe).level,'便宜');
x.snapshot.stocks[x.stock.code].date='2026-10-11';
assert.equal(valuationAssessment(x.stock,x.snapshot,x.universe).status,'missing');
x=make('半導體業','pe',null);
assert.equal(valuationAssessment(x.stock,x.snapshot,x.universe).status,'missing');
x=make('半導體業','pe',20);x.universe.length=7;
assert.equal(valuationAssessment(x.stock,x.snapshot,x.universe).status,'missing');
console.log('valuation checks passed');

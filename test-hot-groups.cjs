const fs=require('fs'),vm=require('vm'),zlib=require('zlib'),assert=require('assert/strict');
const groups=JSON.parse(fs.readFileSync('app.js','utf8').match(/const STOCK_GROUPS=(.*?);/)[1]);
const records=JSON.parse(zlib.gunzipSync(fs.readFileSync('seed.json.gz'))).stocks;
const panels=new Map();const root={hidden:false,querySelector:s=>s==='.sector-heading'?{after:p=>panels.set('#'+p.id,p)}:panels.get(s),querySelectorAll:()=>[]};
const ctx={STOCK_GROUPS:groups,records,mode:'live',analyses:[],window:{},renderSectors:()=>{},$:()=>root,fmt:(v,n=2)=>v.toFixed(n),esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),document:{createElement:()=>({innerHTML:'',querySelector:()=>({addEventListener:()=>{}})})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('sector-capital.js','utf8'),ctx);ctx.renderSectors();
const hot=panels.get('#sector-hot-strength').innerHTML;
for(const name of ['散熱','航運','被動元件','石英','矽晶圓','記憶體','PCB 製板','AI鑽針與鑽孔加工','PCB 載板','台塑四寶','軍工','特用化學','化學股','LED','玻璃基板','資安','FOPLP 扇出型封裝','CoWoS','功率半導體','PMIC','MCU','矽智財','連接器','金融','ASIC','鈣鈦礦','工業電腦','安全監控','系統整合','面板'])assert.ok(hot.includes('data-hot-group="'+name+'"'),name);
assert.equal((hot.match(/data-hot-group="矽晶圓"/g)||[]).length,1);
assert.ok(!hot.includes('data-hot-group="BBU"'));
assert.ok(!hot.includes('data-hot-group="資訊服務"'));
assert.ok(hot.includes('data-hot-group="電池模組"'));
assert.ok(hot.includes('data-hot-stock="3707"'));assert.ok(hot.includes('data-hot-stock="2342"'));
assert.ok(!hot.includes('NaN'));assert.ok(hot.includes('站上 20MA'));assert.ok(hot.includes('hot-stock-ma'));assert.ok(!hot.includes('data-hot-group="生技"'));assert.ok(!hot.includes('data-hot-group="遊戲"'));assert.ok(!hot.includes('data-hot-group="觀光"'));assert.ok(!hot.includes('data-hot-group="紡織纖維"'));assert.ok(!hot.includes('data-hot-group="紙類"'));
console.log('snapshot hot groups:',(hot.match(/data-hot-group=/g)||[]).length);
console.log('Top groups:',[...hot.matchAll(/<strong>([^<]+)<\/strong><small>強度/g)].slice(0,5).map(x=>x[1]));
assert.equal(panels.has('#sector-daily-strength'),false);
assert.ok(!root.innerHTML.includes('sector-taxonomy'));
assert.ok(!root.innerHTML.includes('台股主要產業細分類'));
assert.ok(!root.innerHTML.includes('sector-theme'));
console.log('Hot ranking only, defense retained and BBU removed, members, and data metrics verified.');

// A rank of 1 is strongest; members without a rank must follow ranked members.
ctx.analyses=records.map((stock,index)=>({code:stock.code,score:15-index%16,rank:index%5===0?null:index+1}));
ctx.renderSectors();
const sortedHtml=panels.get('#sector-hot-strength').innerHTML;
for(const group of sortedHtml.matchAll(/data-hot-group="[^"]+"[^>]*>([\s\S]*?)<\/details>/g)){
 const codes=[...group[1].matchAll(/data-hot-stock="([^"]+)"/g)].map(m=>m[1]);
 const ranks=codes.map(code=>ctx.analyses.find(s=>s.code===code)?.rank??Infinity);
 for(let i=1;i<ranks.length;i++)assert.ok(ranks[i]>=ranks[i-1],'MA ranks must be ascending, unranked last');
}
console.log('All member lists follow strongest MA rank first, unranked last.');

const fs=require('fs'),vm=require('vm'),zlib=require('zlib'),assert=require('node:assert/strict');
const groups=JSON.parse(fs.readFileSync('app.js','utf8').match(/const STOCK_GROUPS=(.*?);/)[1]);
const records=JSON.parse(zlib.gunzipSync(fs.readFileSync('seed.json.gz'))).stocks;
const report=JSON.parse(fs.readFileSync('revenue-seed.json','utf8'));
const nodes=new Map();
const root={hidden:false,innerHTML:'',querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{value:'',addEventListener(){},showModal(){},close(){}});return nodes.get(selector);},querySelectorAll(){return [];}};
const ctx={STOCK_GROUPS:groups,records,analyses:records.map(s=>({...s,score:10})),mode:'live',renderSectors(){},$:()=>root,esc:s=>String(s),fetch:async()=>({ok:true,json:async()=>report}),Date,console};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('sector-capital.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('revenue-radar.js','utf8'),ctx);
setImmediate(()=>{
 const expected=[...ctx.getHotSectorGroups().keys()].sort();
 const actual=[...root.innerHTML.matchAll(/class="sector-theme revenue-theme"[^>]*><summary>(.*?) <small>/g)].map(m=>m[1]).sort();
 assert.equal(expected.length,42);assert.deepEqual(actual,Array.from(expected));
 for(const removed of ['生技','遊戲','觀光','紡織纖維','紙類','資訊服務','BBU'])assert.ok(!actual.includes(removed));
 assert.ok(!actual.includes('半導體'));assert.ok(actual.includes('PMIC（電源管理IC）'));assert.ok(actual.includes('MCU（微控制器）'));
 // Search remains market-wide, including companies outside the curated themes.
 const codes=new Set([...ctx.getHotSectorGroups().values()].flatMap(s=>[...s]));
 const outside=Object.entries(report.stocks).find(([code])=>!codes.has(code));assert.ok(outside);
 root.querySelector('#revenue-search').value=outside[0];nodes.get('#revenue-search-form').onsubmit({preventDefault(){}});
 assert.ok(root.innerHTML.includes(`data-code="${outside[0]}"`));
 console.log('Revenue uses exactly the same 42 subgroups; old categories removed; full-market search retained.');
});


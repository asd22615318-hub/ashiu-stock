const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{bFixture}=require('./featured-radar-model.test.cjs');
(async()=>{
 const fixture=bFixture(),events={},tabs=['A','B','C'].map(frTab=>({dataset:{frTab}})),form={},controls={'#fr-query':{value:''},'#fr-view':{}};
 const content={innerHTML:'',querySelector(s){if(s==='form')return form;return controls[s]||null;},querySelectorAll(s){return s==='[data-fr-tab]'?tabs:[];}};
 const shell={open:false,addEventListener:(name,fn)=>events[name]=fn},root={querySelector:s=>s==='details'?shell:content};
 const data={'ownership-data.json':fixture.ctx.ownership,'broker-data.json':fixture.ctx.broker,'broker-daily-data.json':fixture.ctx.daily,'taiwan-sentiment-data.json':fixture.ctx.benchmark,'regulatory-data.json':fixture.ctx.regulatory,'featured-trade-values-data.json':{dates:{}}};
 const context={document:{getElementById:()=>root,createElement:()=>({}),head:{appendChild(){}}},window:{featuredRadarModel:require('./featured-radar-model.js'),getHotSectorGroups:()=>new Map(),addEventListener(){}},mode:'live',records:[fixture.stock],analyses:[{...fixture.stock,t:fixture.stock.bars.at(-1),score:10}],fetch:async url=>({ok:true,json:async()=>data[url]})};
 vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/featured-radar.js','utf8'),context);
 shell.open=true;events.toggle();await new Promise(resolve=>setImmediate(resolve));assert(content.innerHTML.includes('主力吸籌'));assert(content.innerHTML.includes('主力準備發動'));
 tabs[1].onclick();assert(content.innerHTML.includes('data-fr-stock="9991"'));assert(content.innerHTML.includes('100 分')||content.innerHTML.includes('/ 100'));assert(content.innerHTML.includes('15 分資料待核對'));assert(content.innerHTML.includes('收盤 60 元'));
 controls['#fr-query'].value='不存在';form.onsubmit({preventDefault(){}});assert(content.innerHTML.includes('目前沒有符合此雷達'));
 console.log('Featured topic opening, live data, A/B tabs, partial score disclosure and confirmed search passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
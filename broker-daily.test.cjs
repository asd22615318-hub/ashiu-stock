const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const output={innerHTML:''},peer={dataset:{dailyPeerScore:'6173'},innerHTML:''},code=fs.readFileSync(__dirname+'/broker-daily.js','utf8');
 const row=(date,net)=>({date,unit:'lots',top_n:15,buy_lots:net>0?100:40,sell_lots:net>0?40:100,net_lots:net,volume_lots:200,source:'https://example.com'});
 const snapshot={version:1,sessions:[{date:'2026-10-20',stocks:{6173:row('2026-10-20',60)}},{date:'2026-10-22',stocks:{6173:row('2026-10-22',-60)}}]};
 const context={document:{getElementById:()=>output,querySelectorAll:()=>[peer]},window:{addEventListener(){},dailyChipStrength:require('./daily-chip-strength.js')},records:[{code:'6173',bars:['2026-10-20','2026-10-21','2026-10-22'].map(date=>({date,volume:200}))}],ownership:{weeks:[{date:'2026-10-16',stocks:{6173:{400:30}}},{date:'2026-10-22',stocks:{6173:{400:31}}}]},institutional:{report_dates:['2026-10-22'],stocks:{6173:{daily_history:[{date:'2026-10-22',total:10}]}}},fetch:async()=>({ok:true,json:async()=>snapshot})};
 vm.createContext(context);vm.runInContext(code,context);context.window.renderOwnershipDailyConcentration('6173');
 await new Promise(resolve=>setImmediate(resolve));
 assert(peer.innerHTML.includes('50 / 100 分'));assert(peer.innerHTML.includes('2026-10-22'));assert(peer.innerHTML.includes('width:50%'));assert(output.innerHTML.includes('50 / 100 分'));
 assert(output.innerHTML.includes('+30%'));assert(output.innerHTML.includes('-30%'));
 assert(output.innerHTML.includes('此交易日尚未收錄'));assert(output.innerHTML.includes('#ff647b'));assert(output.innerHTML.includes('#4dd5bd'));
 context.window.renderOwnershipDailyConcentration('9999');assert(output.innerHTML.includes('此股當日報表未收錄'));assert(!output.innerHTML.includes('+30%'));
 console.log('Daily chart: signed values, missing dates, missing stocks and stock switching passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
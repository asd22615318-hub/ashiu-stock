import {analyzeBranches} from './broker-radar-engine.js';
const $=id=>document.getElementById(id);
let data=null;
function parseCSV(text){
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 const parse=line=>{let a=[],v='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){v+='"';i++;}else q=!q;}else if(c===','&&!q){a.push(v.trim());v='';}else v+=c;}a.push(v.trim());return a;};
 const heads=parse(lines.shift());const required=['date','stock_id','securities_trader_id','buy','sell'];
 if(required.some(k=>!heads.includes(k)))throw Error('缺少必要欄位：'+required.filter(k=>!heads.includes(k)).join(', '));
 return lines.filter(Boolean).map(line=>Object.fromEntries(parse(line).map((v,i)=>[heads[i],v])));
}
function td(tr,value){const c=document.createElement('td');c.textContent=String(value??'—');tr.append(c);}
function render(mode){
 const rows=mode==='stock'?data.forStock($('stock').value.trim()):mode==='swing'?data.swing_top20:data.day_trade_top20;
 const body=$('results');body.replaceChildren();
 for(const p of rows){const tr=document.createElement('tr');[p.branch_name||p.branch_id,p.branch_id,p.stock_id,p.buy_events,p.day_trade_score,p.swing_score,p.net_buy].forEach(x=>td(tr,x));body.append(tr);}
 $('status').textContent=rows.length?'共 '+rows.length+' 筆；分數為統計傾向，非實際持倉或勝率。':'沒有符合樣本門檻的資料。';
}
$('file').addEventListener('change',async e=>{
 try{
 const file=e.target.files[0];if(!file)return;
 if(file.size>20*1024*1024)throw Error('檔案不可超過 20MB');
 const rows=parseCSV(await file.text());
 data=analyzeBranches(rows);
 $('status').textContent='已在瀏覽器本機分析 '+rows.length+' 筆。資料不會上傳。';
 render(document.querySelector('input[name=mode]:checked').value);
 }catch(err){$('status').textContent='匯入失敗：'+err.message;}
});
document.querySelectorAll('input[name=mode]').forEach(x=>x.addEventListener('change',()=>data&&render(x.value)));
$('stock').addEventListener('input',()=>data&&document.querySelector('input[value=stock]').checked&&render('stock'));

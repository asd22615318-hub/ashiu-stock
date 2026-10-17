(function(){
  'use strict';
  const factors=[
    {id:'momentum',name:'加權指數動能',weight:20,unit:'%',note:'加權指數相對20日均線乖離，越強越偏貪婪'},
    {id:'relative',name:'櫃買相對強弱',weight:20,unit:'百分點',note:'櫃買20日報酬減加權20日報酬，越高代表風險偏好較強'},
    {id:'volatility',name:'市場波動',weight:20,unit:'%',inverse:true,note:'20日報酬年化波動，越高越偏恐懼'},
    {id:'foreign',name:'外資現貨力道',weight:20,unit:'億元',note:'上市外資近5個交易日現貨淨買賣超，越高越偏貪婪'},
    {id:'leverage',name:'融資追價情緒',weight:20,unit:'%',note:'上市＋上櫃融資餘額5日增減率，越高代表融資情緒較積極'}
  ];
  const finite=Number.isFinite;
  const sum=a=>a.reduce((s,v)=>s+v,0);
  function computeTaiwanSentiment(input){
    const rows=[...new Map((Array.isArray(input?.rows)?input.rows:[]).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.d)&&finite(r.i)&&r.i>0).map(r=>[r.d,r])).values()].sort((a,b)=>a.d.localeCompare(b.d));
    const raw=rows.map((r,j)=>{
      const result={date:r.d,taiex:r.i};
      if(j>=19){const w=rows.slice(j-19,j+1);result.momentum=(r.i/(sum(w.map(x=>x.i))/20)-1)*100;}
      if(j>=20){const old=rows[j-20],w=rows.slice(j-20,j+1);if(finite(r.o)&&r.o>0&&finite(old.o)&&old.o>0)result.relative=((r.o/old.o-1)-(r.i/old.i-1))*100;const returns=w.slice(1).map((x,i)=>Math.log(x.i/w[i].i)),mean=sum(returns)/20;result.volatility=Math.sqrt(sum(returns.map(v=>(v-mean)**2))/19)*Math.sqrt(252)*100;}
      if(j>=4){const w=rows.slice(j-4,j+1);if(w.every(x=>finite(x.sf)))result.foreign=sum(w.map(x=>x.sf));}
      if(j>=5){const old=rows[j-5];if([r.mt,r.mo,old.mt,old.mo].every(x=>finite(x)&&x>=0)&&old.mt+old.mo>0)result.leverage=((r.mt+r.mo)/(old.mt+old.mo)-1)*100;}
      return result;
    });
    const points=[];
    for(let j=0;j<raw.length;j++){
      const components=[];
      for(const f of factors){
        const value=raw[j][f.id],prior=raw.slice(Math.max(0,j-120),j).map(r=>r[f.id]).filter(finite);
        if(!finite(value)||prior.length<60)break;
        const percentile=100*(prior.filter(v=>v<value).length+prior.filter(v=>v===value).length*.5)/prior.length;
        components.push({...f,value,score:f.inverse?100-percentile:percentile,baseline:prior.length});
      }
      // Fixed weights: a missing component never becomes zero or gets reweighted.
      if(components.length===factors.length)points.push({date:raw[j].date,score:sum(components.map(c=>c.score*c.weight/100)),taiex:raw[j].taiex,components});
    }
    return {version:1,market:'台股',model:'tw-sentiment-v1',modelName:'本站自編・五因子等權',source:input?.source||'https://zhuang.tw/futchip',updatedAt:input?.built||'',latestInputDate:rows.at(-1)?.d||'',sourceKind:input?.sourceKind||'台股盤後行情與籌碼（公開彙整資料）',rows:points};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={computeTaiwanSentiment,factors};
  if(typeof window!=='undefined')window.computeTaiwanSentiment=computeTaiwanSentiment;
})();

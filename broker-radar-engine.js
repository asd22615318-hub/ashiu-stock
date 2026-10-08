// Broker branch radar — data-only scoring engine.
// Input rows: {date,stock_id,securities_trader_id,securities_trader,buy,sell}
// buy/sell must use the same units. All classifications are estimates, not account positions.
export function analyzeBranches(rows, {minEvents=5}={}) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  const byPair=new Map();
  for (const r of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date||'') || !r.stock_id || !r.securities_trader_id) continue;
    const buy=Number(r.buy), sell=Number(r.sell);
    if (![buy,sell].every(x=>Number.isFinite(x)&&x>=0)) continue;
    const key=String(r.securities_trader_id)+'|'+String(r.stock_id);
    if (!byPair.has(key)) byPair.set(key,{id:String(r.securities_trader_id),name:r.securities_trader||'',stock:String(r.stock_id),days:new Map()});
    const p=byPair.get(key), d=p.days.get(r.date)||{buy:0,sell:0};
    d.buy+=buy;d.sell+=sell;p.days.set(r.date,d);
  }
  const pairs=[];
  for (const p of byPair.values()) {
    const dates=[...p.days.keys()].sort();
    let events=0,nextSellRatioSum=0,streak=0,maxStreak=0,net=0,positiveDays=0;
    for(let i=0;i<dates.length;i++){
      const d=p.days.get(dates[i]),delta=d.buy-d.sell;
      net+=delta;
      if(delta>0){streak++;positiveDays++;}else streak=0;
      maxStreak=Math.max(maxStreak,streak);
      if(delta>0 && i+1<dates.length){
        const next=p.days.get(dates[i+1]);
        // Next observed date must be an actual consecutive market session in supplied dataset.
        // Missing sessions make the metric unreliable; callers must supply complete trading dates.
        events++;
        nextSellRatioSum+=Math.min(1,Math.max(0,next.sell-next.buy)/delta);
      }
    }
    const nextDaySellRatio=events?nextSellRatioSum/events:null;
    const dayTradeScore=events>=minEvents?Math.round(100*nextDaySellRatio):null;
    const swingScore=dates.length>=minEvents?Math.round(100*(0.45*(positiveDays/dates.length)+0.30*Math.min(maxStreak/5,1)+0.25*(net>0?1:0))):null;
    pairs.push({branch_id:p.id,branch_name:p.name,stock_id:p.stock,observed_days:dates.length,buy_events:events,net_buy:net,next_day_sell_ratio:nextDaySellRatio,day_trade_score:dayTradeScore,swing_score:swingScore});
  }
  function rank(field){return pairs.filter(p=>p[field]!==null).sort((a,b)=>b[field]-a[field]||b.buy_events-a.buy_events).slice(0,20);}
  return {pairs,day_trade_top20:rank('day_trade_score'),swing_top20:rank('swing_score'),forStock:stockId=>pairs.filter(p=>p.stock_id===String(stockId)).sort((a,b)=>(b.day_trade_score??-1)-(a.day_trade_score??-1))};
}

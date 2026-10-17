export const CNN_SOURCE='https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
export const CNN_ARCHIVE='https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/json/cnn_output.json';
export function normalizeFearGreed(raw,source=CNN_SOURCE,now=Date.now()){
  const current=raw?.fear_and_greed;
  if(!current||!Number.isFinite(current.score)||current.score<0||current.score>100)throw Error('恐懼貪婪指數格式不正確');
  const timestamp=Date.parse(current.timestamp);
  if(!Number.isFinite(timestamp)||timestamp>now+3600000)throw Error('指數日期不正確');
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));
  const day=x=>new Date(x).toISOString().slice(0,10),sp=new Map(),history=new Map();
  for(const r of raw.market_momentum_sp500?.data||[]){if(Number.isFinite(r.x)&&Number.isFinite(r.y)&&r.y>0&&r.x<=now){const d=day(r.x);if(d<=date)sp.set(d,r.y);}}
  for(const r of raw.fear_and_greed_historical?.data||[]){if(Number.isFinite(r.x)&&Number.isFinite(r.y)&&r.y>=0&&r.y<=100&&r.x<=now){const d=day(r.x);if(d<=date)history.set(d,{date:d,score:r.y,sp500:sp.get(d)??null});}}
  history.set(date,{date,score:current.score,sp500:sp.get(date)??history.get(date)?.sp500??null});
  const rows=[...history.values()].sort((a,b)=>a.date.localeCompare(b.date));
  if(rows.length<10)throw Error('指數歷史資料不足');
  return {version:1,market:'美股',source,sourceKind:source===CNN_SOURCE?'CNN 原始資料':'CNN 公開資料留存（whit3rabbit）',updatedAt:current.timestamp,rows};
}

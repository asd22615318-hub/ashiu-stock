function ruleDiagram(key,name){
 const red='#d51f35',green='#00945f',purple='#9470b4',gold='#bd9528';
 const candle=(x,o,c,h,l)=>{const color=c<o?red:green;return `<line x1="${x}" y1="${h}" x2="${x}" y2="${l}" stroke="${color}" stroke-width="2"/><rect x="${x-8}" y="${Math.min(o,c)}" width="16" height="${Math.max(3,Math.abs(o-c))}" fill="${color}"/>`;};
 const text=(x,y,t,color='#51435e',anchor='start')=>`<text x="${x}" y="${y}" fill="${color}" font-size="11" text-anchor="${anchor}">${t}</text>`;
 const line=(y,t,color=gold)=>`<path d="M24 ${y}H274" stroke="${color}" stroke-dasharray="5 4"/>${text(272,y-5,t,color,'end')}`;
 const ma='<path d="M22 132L275 88" stroke="'+purple+'" stroke-width="2.5" fill="none"/>';
 const dot=(x,y)=>`<circle cx="${x}" cy="${y}" r="5" fill="${gold}"/>`;
 const rise=candle(45,129,108,100,140)+candle(86,112,89,80,120)+candle(127,91,65,58,99);
 let content='';
 if(key==='dragon')content=ma+rise+candle(180,76,96,67,103)+text(174,58,'量縮黑',green)+text(269,149,'五日線不破',purple,'end');
 else if(['dance','smallDance','swordDance'].includes(key))content=ma+candle(45,130,111,105,140)+candle(89,111,89,82,120)+candle(151,50,92,key==='swordDance'?20:40,105)+candle(221,85,99,78,105)+dot(221,99)+text(143,28,key==='swordDance'?'長上影劍':key==='smallDance'?'短期新高':'創高黑',green)+text(228,121,'收盤入',gold)+ (key==='smallDance'?line(35,'前高未過'):line(65,'',gold));
 else if(key==='sword')content=rise+candle(194,74,57,18,84)+text(204,28,'上影（劍）',gold)+line(84,'劍低');
 else if(key==='panther')content=candle(90,111,70,60,118)+candle(206,51,118,28,136)+text(75,48,'前日不限漲停',red)+text(195,20,'上衝後收黑',green,'middle')+line(136,'黑 K 低',green)+text(150,158,'量 > 前 5 日均量',green,'middle');
 else if(key==='mother')content=candle(102,135,60,45,151)+candle(199,83,112,70,132)+line(45,'高不過高')+line(151,'低不破低');
 else if(key==='shadow')content=candle(84,101,68,55,112)+candle(191,89,104,81,156)+line(101,'收接近昨收',green)+`<path d="M170 130H265" stroke="${gold}" stroke-dasharray="5 4"/>`+text(177,144,'下影一半',gold)+text(20,174,'破昨低後拉回 · 收 ≥ 昨收為較強示意');
 else if(key==='extremeDance')content=rise+candle(198,51,133,39,145)+`<path d="M22 157L275 129" stroke="#467fa9" stroke-width="2.5"/>`+text(190,25,'創高後量縮長黑',green,'middle')+text(266,168,'接近 MA10', '#467fa9','end');
 else if(key==='nearCross')content=`<path d="M25 55L275 65" stroke="${purple}" stroke-width="2"/><path d="M25 128L275 113" stroke="#467fa9" stroke-width="2"/><path d="M25 147L275 137" stroke="${gold}" stroke-width="2"/>`+candle(72,121,110,104,129)+candle(132,110,91,86,118)+candle(195,96,79,70,103)+text(268,48,'MA20 上方尚未突破',purple,'end')+text(268,128,'MA60', '#467fa9','end')+text(268,155,'20 週線',gold,'end');
 else if(key==='headShoulders')content=`<path d="M24 52L60 113L96 61L146 156L194 58L230 111L277 43" fill="none" stroke="${green}" stroke-width="3"/>`+line(60,'頸線')+text(47,137,'左肩')+text(137,175,'頭')+text(215,137,'右肩');
 else if(key==='triangle')content=`<path d="M25 38L275 89M25 153L275 101" stroke="${purple}" stroke-width="2"/><path d="M30 45L70 141L111 58L146 125L185 75L220 108L250 91L275 69" fill="none" stroke="${green}" stroke-width="3"/>`+text(155,24,'高點降低 · 低點墊高',purple,'middle');
 else if(key==='vcp')content=`<path d="M24 35Q60 202 114 38Q150 143 195 39Q217 95 243 39L275 22" fill="none" stroke="${green}" stroke-width="3"/>`+line(39,'突破觀察')+text(54,172,'大回檔')+text(140,132,'小回檔')+text(213,98,'再收縮')+text(150,187,'振幅與成交量逐次收縮',purple,'middle');
 return `<svg viewBox="0 0 300 200" role="img" aria-label="${name}解釋示意圖"><title>${name}：非實際行情</title>${content}</svg>`;
}

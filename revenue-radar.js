/* Official monthly revenue, grouped by the site's existing stock taxonomy. */
(() => {
  let report = null;
  let error = '';
  let positiveOnly = true;
  let market = 'all';
  let query = '';
  let leadersOpen = true;
  const percent = value => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const stockCard = stock => `<button class="revenue-stock" type="button" data-code="${esc(stock.code)}" ${stock.quote ? '' : 'disabled'}><span class="revenue-stock-name"><strong>${esc(stock.name)}</strong><small>${esc(stock.code)} · ${esc(stock.revenue.market)}</small></span><span class="revenue-stock-metric revenue-stock-score"><small>均線分數</small><b>${stock.quote?.score == null ? '待補' : `${stock.quote.score}/15`}</b></span><span class="revenue-stock-metric revenue-stock-yoy"><small>年增</small><b>${percent(stock.revenue.yoy)}</b></span><span class="revenue-stock-metric revenue-stock-mom"><small>月增</small><b>${percent(stock.revenue.mom)}</b></span><span class="revenue-stock-metric"><small>累計年增</small><b class="${stock.revenue.ytd_yoy >= 0 ? 'up' : 'down'}">${percent(stock.revenue.ytd_yoy)}</b></span></button>`;
  const searchCard = stock => `<article class="revenue-stock revenue-search-card"><span class="revenue-stock-name">${stock.quote ? `<button type="button" class="revenue-stock-open" data-code="${esc(stock.code)}">${esc(stock.name)} ↗</button>` : `<strong>${esc(stock.name)}</strong>`}<small>${esc(stock.code)} · ${esc(stock.revenue.market)}${stock.quote ? ' · 點名稱看完整個股資訊' : ' · 暫無日線個股資訊'}</small></span><span class="revenue-stock-metric revenue-stock-score"><small>均線分數</small><b>${stock.quote?.score == null ? '待補' : `${stock.quote.score}/15`}</b></span><span class="revenue-stock-metric revenue-stock-yoy"><small>年增</small><b>${percent(stock.revenue.yoy)}</b></span><span class="revenue-stock-metric revenue-stock-mom"><small>月增</small><b>${percent(stock.revenue.mom)}</b></span><span class="revenue-stock-metric"><small>累計年增</small><b>${percent(stock.revenue.ytd_yoy)}</b></span></article>`;

  // Reviewed official classifications. Product presence is not treated as revenue share.
  const REVENUE_BUSINESS = {
  "1101": {
    "labels": [
      "水泥 > 石灰石",
      "水泥 > 水泥生料",
      "水泥 > 水泥熟料",
      "水泥 > 水泥成品",
      "水泥 > 預拌混凝土"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=1101",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "水泥",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "1210": {
    "labels": [
      "食品 > 原物料",
      "食品 > 加工食品",
      "食品 > 冷凍、罐頭、脫水、醃漬食品"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=1210",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "食品",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "1229": {
    "labels": [
      "食品 > 加工食品",
      "雲端運算 > 系統整合"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=1229",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "食品／雲端運算",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "1336": {
    "labels": [
      "電腦及週邊設備 > 金屬、塑膠模具",
      "平面顯示器 > 塑膠框",
      "通信網路 > 塑膠/金屬機殼"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=1336",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "電腦及週邊設備／平面顯示器／通信網路",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "1402": {
    "labels": [
      "石化及塑橡膠 > 塑膠製品",
      "紡織 > 石化原料(例如純對苯二甲酸、乙二醇、己內醯胺、丙烯腈等)",
      "紡織 > 人造纖維產品(例如尼龍纖維、聚酯纖維、嫘縈纖維等)",
      "紡織 > 染整",
      "紡織 > 成衣及其它家居紡織類品",
      "建材營造 > 建設業",
      "建材營造 > 工程承攬",
      "石化及塑橡膠 > PTA(對苯二甲酸)觸媒"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=1402",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "石化及塑橡膠／紡織／建材營造",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "1409": {
    "labels": [
      "石化及塑橡膠 > 人造纖維",
      "紡織 > 人造纖維產品(例如尼龍纖維、聚酯纖維、嫘縈纖維等)"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=1409",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "石化及塑橡膠／紡織",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "1434": {
    "labels": [
      "半導體 > IC封裝測試",
      "半導體 > IC模組",
      "石化及塑橡膠 > 塑膠製品",
      "紡織 > 紡紗",
      "紡織 > 織布",
      "紡織 > 染整",
      "油電燃氣 > 加油站"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=1434",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "半導體／石化及塑橡膠／紡織／油電燃氣",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "1460": {
    "labels": [
      "紡織 > 紡紗",
      "紡織 > 織布",
      "紡織 > 染整",
      "紡織 > 成衣及其它家居紡織類品"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=1460",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "紡織",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "1476": {
    "labels": [
      "彈性針織布",
      "機能性成衣"
    ],
    "source": "https://www.eclat.com.tw/zh-tw/company/",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "公司官網（查核日 2026-11-28）",
    "mix": null,
    "category": "機能布料／運動成衣",
    "note": "依公司布料與成衣業務歸類，未推估兩者營收占比。"
  },
  "1477": {
    "labels": [
      "成衣設計製造",
      "成衣外銷"
    ],
    "source": "https://www.makalot.com.tw/uploads/%E5%B9%B4%E5%A0%B1/%E8%81%9A%E9%99%BD%E5%B9%B4%E5%A0%B1%E5%8D%B0%E8%A3%BD%E7%94%A8_1140508.pdf",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "2024年度年報；2025年刊印",
    "mix": null,
    "category": "成衣製造",
    "note": "依年報成衣設計、生產及外銷業務歸類。"
  },
  "1560": {
    "labels": [
      "再生晶圓",
      "CMP鑽石碟",
      "砂輪研磨工具"
    ],
    "source": "https://www.kinik.com.tw/en-us/Investor/MeetingReport.html",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "2025年度；2026-03-10發布",
    "mix": null,
    "category": "半導體耗材／再生晶圓",
    "note": "2025年致股東報告說明再生晶圓、鑽石碟及砂輪業務；不沿用舊五金分類。"
  },
  "1598": {
    "labels": [
      "運動科技 > 健身器材"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=1598",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "運動科技",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2103": {
    "labels": [
      "石化及塑橡膠 > 橡膠製品"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2103",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "石化及塑橡膠",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2105": {
    "labels": [
      "石化及塑橡膠 > 橡膠製品"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2105",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "石化及塑橡膠",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2301": {
    "labels": [
      "汽車 > 銷售、進出口業務",
      "電腦及週邊設備 > 機殼",
      "電腦及週邊設備 > 電源供應器",
      "電腦及週邊設備 > 伺服器",
      "電腦及週邊設備 > 其他電腦及週邊設備",
      "電腦及週邊設備 > 安全監控系統",
      "通信網路 > 網路設備(如數據機、網路卡、閘道器、路由器、網路電話)",
      "通信網路 > 無線通訊設備(如行動電話、衛星定位系統、衛星通訊設備、微波通訊設備、數位機上盒)",
      "其他 > 其他電子產品及電子服務產業",
      "汽車 > 車燈",
      "汽車 > 其他",
      "雲端運算 > 電力設備",
      "雲端運算 > 冷卻設備",
      "雲端運算 > 雲端應用服務",
      "雲端運算 > 系統整合",
      "雲端運算 > 顧問諮詢",
      "雲端運算 > 設備安裝服務",
      "雲端運算 > IaaS",
      "雲端運算 > PaaS",
      "雲端運算 > SaaS",
      "體驗科技 > 環境感知",
      "體驗科技 > 深度感測",
      "體驗科技 > 視覺",
      "體驗科技 > 手勢/動作",
      "LED照明產業 > 封裝/模組",
      "LED照明產業 > 燈具/應用",
      "電動車輛產業 > 大功率鋰電池芯/模組、電池管理系統、動力馬達等零組件",
      "智慧電網 > 配電管理設施",
      "醫療器材 > 醫療耗材",
      "醫療器材 > 生物檢測"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2301",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "汽車／電腦及週邊設備／通信網路／雲端運算／體驗科技／LED照明產業／電動車輛產業／智慧電網／醫療器材",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2302": {
    "labels": [
      "半導體 > 其他IC/二極體製造"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2302",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "半導體",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2353": {
    "labels": [
      "電腦及週邊設備 > 筆記型電腦",
      "電腦及週邊設備 > 桌上型電腦",
      "電腦及週邊設備 > 伺服器",
      "電腦及週邊設備 > 其他電腦及週邊設備",
      "電腦及週邊設備 > 印表機、傳真機、掃瞄器、多功能事務機、投影機"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2353",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "電腦及週邊設備",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2376": {
    "labels": [
      "電腦及週邊設備 > 顯示器模組",
      "電腦及週邊設備 > 主機板",
      "電腦及週邊設備 > 機殼",
      "電腦及週邊設備 > 電源供應器",
      "電腦及週邊設備 > 散熱片、風扇馬達、散熱模組",
      "電腦及週邊設備 > 顯示卡",
      "電腦及週邊設備 > 筆記型電腦",
      "電腦及週邊設備 > 桌上型電腦",
      "電腦及週邊設備 > 工業電腦",
      "電腦及週邊設備 > 精簡型電腦",
      "電腦及週邊設備 > 伺服器",
      "電腦及週邊設備 > 其他電腦及週邊設備",
      "電動車輛產業 > 大功率鋰電池芯/模組、電池管理系統、動力馬達等零組件"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2376",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "電腦及週邊設備／電動車輛產業",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2464": {
    "labels": [
      "電腦及週邊設備 > 其他電腦及週邊設備",
      "電機機械 > 輸送機械及零配件",
      "電機機械 > 機電系統工程"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2464",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "電腦及週邊設備／電機機械",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2491": {
    "labels": [
      "照明應用產品",
      "電子零組件代理",
      "多媒體資訊產品貿易"
    ],
    "source": "https://www.focl.com.tw/about.php",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "公司官網（查核日 2026-11-28）",
    "mix": null,
    "category": "照明應用／電子產品代理",
    "note": "依現行公司簡介歸類，不沿用光碟片標籤。"
  },
  "2504": {
    "labels": [
      "水泥 > 預拌混凝土",
      "建材營造 > 建材原料"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2504",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "水泥／建材營造",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2511": {
    "labels": [
      "建材營造 > 營造業",
      "建材營造 > 建設業",
      "建材營造 > 工程承攬",
      "建材營造 > 物業管理"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2511",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "建材營造",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2520": {
    "labels": [
      "建材營造 > 建設業"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2520",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "建材營造",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2540": {
    "labels": [
      "住宅與大樓開發租售",
      "不動產代銷及仲介"
    ],
    "source": "https://www.isanlin.com/about",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "公司官網（查核日 2026-11-28）",
    "mix": null,
    "category": "建設開發／不動產代銷",
    "note": "官網同時列示開發與代銷；不將舊年度占比當作現況。"
  },
  "2542": {
    "labels": [
      "建材營造 > 建設業"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2542",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "建材營造",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2610": {
    "labels": [
      "交通運輸及航運 > 海陸空大眾運輸"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2610",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "交通運輸及航運",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2617": {
    "labels": [
      "交通運輸及航運 > 散裝航運"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2617",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "交通運輸及航運",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "2645": {
    "labels": [
      "航空器維修服務",
      "航空器零組件製造"
    ],
    "source": "https://www.egat.com.tw/documents/290/EGAT-2025_Annual_General_Shareholders_Meeting_HandbookCh.pdf",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "2024年度財報；2025年股東會資料",
    "mix": null,
    "category": "航空維修／航太零組件",
    "note": "財報分列維修與航空器零組件銷售，與航空客運區分。"
  },
  "2903": {
    "labels": [
      "貿易百貨 > 零售通路"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=2903",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "貿易百貨",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "3014": {
    "labels": [
      "半導體 > LED驅動IC",
      "半導體 > 消費性IC",
      "半導體 > 微控制器IC",
      "半導體 > 輸出入介面IC"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=3014",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "半導體",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "3023": {
    "labels": [
      "電腦及週邊設備 > 連接線",
      "平面顯示器 > 其他零組件",
      "通信網路 > 線材",
      "連接器 > 連接器設計、組裝及製造",
      "LED照明產業 > 燈具/應用",
      "電動車輛產業 > 大功率鋰電池芯/模組、電池管理系統、動力馬達等零組件",
      "太陽能產業 > 太陽能發電設備/系統及系統工程",
      "風力發電 > 其他配件"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=3023",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "電腦及週邊設備／平面顯示器／通信網路／連接器／LED照明產業／電動車輛產業／太陽能產業／風力發電",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "3045": {
    "labels": [
      "通信網路 > 電信服務業"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=3045",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "通信網路",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "3094": {
    "labels": [
      "半導體 > 網路通訊IC"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=3094",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "半導體",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "3141": {
    "labels": [
      "半導體 > 平面顯示器驅動IC"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=3141",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "半導體",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "3219": {
    "labels": [
      "電路板及GPU測試方案",
      "5G毫米波模組"
    ],
    "source": "https://www.aether-tek.com/wp-content/uploads/2025/08/%E5%80%9A%E5%BC%B7_TW_%E5%85%A7%E9%A0%810807%E7%B5%90%E6%A1%88.pdf",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "2024年度永續報告",
    "mix": null,
    "category": "自動化測試設備／毫米波",
    "note": "依2024年營運與產品揭露歸類，不沿用過去影像IC定位。"
  },
  "3227": {
    "labels": [
      "電腦及週邊設備 > 其他電腦及週邊設備之零組件",
      "觸控面板 > 控制IC",
      "汽車 > 其他",
      "人工智慧 > 機器學習",
      "人工智慧 > 電腦視覺",
      "人工智慧 > 移動控制",
      "運動科技 > 感測裝置",
      "半導體 > 影像感測IC",
      "太空衛星科技 > 感測器",
      "體驗科技 > IC",
      "體驗科技 > 環境感知",
      "體驗科技 > 深度感測",
      "體驗科技 > SLAM",
      "體驗科技 > 其他",
      "體驗科技 > 使用者感知",
      "體驗科技 > 視覺",
      "體驗科技 > 手勢/動作",
      "體驗科技 > 觸覺"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=3227",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "電腦及週邊設備／觸控面板／汽車／人工智慧／運動科技／半導體／太空衛星科技／體驗科技",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "3543": {
    "labels": [
      "平面顯示器 > 其他零組件",
      "醫療器材 > 電子零組件、塑膠零件、五金零件",
      "醫療器材 > 醫療器材代理銷售及通路",
      "醫療器材 > 塑化材料",
      "醫療器材 > 金屬零件",
      "醫療器材 > 醫療耗材",
      "醫療器材 > 其他",
      "醫療器材 > 醫療器材代理",
      "醫療器材 > 醫療院所、醫療器材專賣店、藥局等通路"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=3543",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "平面顯示器／醫療器材",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "3711": {
    "labels": [
      "半導體 > IC封裝測試"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=3711",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "半導體",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "3715": {
    "labels": [
      "印刷電路板",
      "車用板",
      "網通及伺服器板"
    ],
    "source": "https://www.dynaholding.com/technology/index.html",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "公司官網（查核日 2026-11-28）",
    "mix": null,
    "category": "PCB製板",
    "note": "依PCB製造業務歸類；終端應用不等於各應用營收占比。"
  },
  "4105": {
    "labels": [
      "製藥 > 原材料",
      "製藥 > 中、西藥製劑",
      "製藥 > 藥品代理銷售及通路"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=4105",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "製藥",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "4147": {
    "labels": [
      "製藥 > 原材料"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=4147",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "製藥",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "4566": {
    "labels": [
      "電機機械 > 車用機械傳動設備及零配件"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=4566",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "電機機械",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "4938": {
    "labels": [
      "半導體 > 基板",
      "電腦及週邊設備 > 主機板",
      "電腦及週邊設備 > 機殼",
      "電腦及週邊設備 > 筆記型電腦",
      "電腦及週邊設備 > 桌上型電腦",
      "平面顯示器 > 其他零組件",
      "通信網路 > 網路設備(如數據機、網路卡、閘道器、路由器、網路電話)",
      "通信網路 > 無線通訊設備(如行動電話、衛星定位系統、衛星通訊設備、微波通訊設備、數位機上盒)"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=4938",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "半導體／電腦及週邊設備／平面顯示器／通信網路",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "5285": {
    "labels": [
      "功率元件導線架",
      "IC導線架"
    ],
    "source": "https://www.jihlin.com.tw/about",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "公司官網（查核日 2026-11-28）",
    "mix": null,
    "category": "半導體導線架",
    "note": "公司揭露沖壓至電鍍一貫作業的半導體導線架業務。"
  },
  "5426": {
    "labels": [
      "電腦及週邊設備 > 其他電腦及週邊設備之零組件"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=5426",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "電腦及週邊設備",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "5871": {
    "labels": [
      "金融 > 租賃業",
      "太陽能產業 > 太陽能電廠"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=5871",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "金融／太陽能產業",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "6141": {
    "labels": [
      "印刷電路板 > 硬板、軟板、IC載板製造"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=6141",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "印刷電路板",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "6179": {
    "labels": [
      "建材營造 > 工程承攬"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=6179",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "建材營造",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "6233": {
    "labels": [
      "電腦及週邊設備 > 晶片組",
      "半導體 > 輸出入介面IC"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=6233",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "電腦及週邊設備／半導體",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "6234": {
    "labels": [
      "自動化 > 自動化機台",
      "自動化 > 整體解決方案",
      "平面顯示器 > 生產製程及檢測設備",
      "電機機械 > 輸送機械及零配件",
      "電機機械 > 機電系統工程",
      "太陽能產業 > 太陽能發電設備/系統及系統工程"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=6234",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "自動化／平面顯示器／電機機械／太陽能產業",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "6278": {
    "labels": [
      "SMT表面黏著加工",
      "液晶控制板",
      "電子產品組裝"
    ],
    "source": "https://www.tsmt.com/products",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "公司官網（查核日 2026-11-28）",
    "mix": null,
    "category": "SMT電子代工／顯示器組裝",
    "note": "依公司加工服務及應用產品歸類，與面板製造區分。"
  },
  "6456": {
    "labels": [
      "觸控及顯示模組",
      "保護玻璃與貼合整合"
    ],
    "source": "https://esg.gis-touch.com/GIS_ESG_PLATFORM/Files/somefiles/202506/496d3e5d-fe4c-4b80-9c8f-6913e2630fe6.pdf",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "公司永續報告；2025年公開",
    "mix": null,
    "category": "觸控顯示模組",
    "note": "依公司觸控顯示核心業務歸類，未把新布局當主要營收。"
  },
  "6526": {
    "labels": [
      "固網寬頻晶片",
      "乙太網晶片",
      "藍牙及衛星定位晶片"
    ],
    "source": "https://www.airoha.com/zh-TW",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "公司官網（查核日 2026-11-28）",
    "mix": null,
    "category": "網通IC／藍牙晶片",
    "note": "公司定位有線網通基礎建設與無線邊緣AI；未推估各產品營收占比。"
  },
  "6548": {
    "labels": [
      "半導體 > 導線架"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=6548",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "半導體",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "6614": {
    "labels": [
      "應用軟體開發",
      "系統整合",
      "雲端及資安服務"
    ],
    "source": "https://www.iisigroup.com/",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "公司官網（查核日 2026-11-28）",
    "mix": null,
    "category": "資訊服務／系統整合",
    "note": "依公司智慧政府、金融、醫療及城市之資訊服務歸類。"
  },
  "6743": {
    "labels": [
      "電腦及週邊設備 > 其他電腦及週邊設備之零組件",
      "通信網路 > 其他零組件",
      "其他 > 其他電子產品及電子服務產業"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=6743",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "電腦及週邊設備／通信網路",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "6902": {
    "labels": [
      "通訊及數位防詐",
      "企業防詐服務",
      "金融科技服務"
    ],
    "source": "https://www.gogolook.com/about",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "公司官網（查核日 2026-11-28）",
    "mix": null,
    "category": "防詐科技／金融科技",
    "note": "依公司防詐與信任科技服務歸類，未推估各服務營收占比。"
  },
  "7711": {
    "labels": [
      "電腦及週邊設備 > 伺服器"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=7711",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "電腦及週邊設備",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "8050": {
    "labels": [
      "電腦及週邊設備 > 工業電腦"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=8050",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "電腦及週邊設備",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "8213": {
    "labels": [
      "印刷電路板 > 硬板、軟板、IC載板製造"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=8213",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "印刷電路板",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "8383": {
    "labels": [
      "半導體 > 生產製程及檢測設備",
      "平面顯示器 > 其他零組件",
      "電機機械 > 機電系統工程",
      "電機機械 > 金屬加工處理",
      "建材營造 > 機電工程",
      "建材營造 > 工程設計",
      "建材營造 > 工程承攬"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=8383",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "半導體／平面顯示器／電機機械／建材營造",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  },
  "9904": {
    "labels": [
      "運動鞋製造",
      "運動用品零售及批發"
    ],
    "source": "https://www.pouchen.com/download/annual-reports/2025%20Annual%20Report-CH.pdf",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "2025年度年報；2026-04-15刊印",
    "mix": [
      {
        "name": "鞋類製造",
        "percent": 70
      },
      {
        "name": "運動用品零售及批發",
        "percent": 30
      }
    ],
    "category": "製鞋／運動用品通路",
    "note": "占比採公司年報整數揭露，僅代表2025年度合併營收。"
  },
  "9935": {
    "labels": [
      "百葉窗",
      "百摺簾及附屬零件"
    ],
    "source": "https://www.chingfeng.com/cn/history.html",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "公司官網（查核日 2026-11-28）",
    "mix": null,
    "category": "居家窗簾",
    "note": "依公司窗簾產品業務歸類。"
  },
  "9939": {
    "labels": [
      "瓶蓋及PET瓶胚",
      "飲料包裝材料",
      "飲料充填代工"
    ],
    "source": "https://www.honchuan.com/tw/about-thc",
    "sourceType": "公司業務揭露",
    "checked": "2026-11-28",
    "period": "公司官網（查核日 2026-11-28）",
    "mix": null,
    "category": "飲料包材／飲料代工",
    "note": "依公司包材與飲料充填整合業務歸類，與一般塑膠製品區分。"
  },
  "9945": {
    "labels": [
      "建材營造 > 結構工程",
      "建材營造 > 機電工程",
      "建材營造 > 工程設計",
      "建材營造 > 營造業",
      "建材營造 > 建設業",
      "建材營造 > 裝潢業",
      "建材營造 > 物業管理"
    ],
    "source": "https://ic.tpex.org.tw/company_chain.php?stk_code=9945",
    "sourceType": "官方產業鏈",
    "checked": "2026-11-28",
    "period": "官方網站查核日",
    "mix": null,
    "category": "建材營造",
    "note": "官方產業鏈歸屬；未據此推定主要營收或占比。"
  }
};
  function revenueBusinessDetails(stock){
    const info=REVENUE_BUSINESS[stock.code];
    if(!info)return '';
    const mix=info.mix?.map(x=>esc(x.name)+' '+x.percent+'%').join('、');
    return '<details class="revenue-business" style="margin-top:8px;min-width:0;overflow-wrap:anywhere;color:#dce5ef"><summary style="font-weight:700;color:#ffe298;cursor:pointer">'+esc(info.category)+' · 分類依據</summary><p>'+info.labels.map(esc).join('、')+'</p>'+(mix?'<p><strong>營收占比：'+mix+'</strong></p>':'<p>尚未核實營收占比</p>')+'<p>'+esc(info.note)+'</p><p>'+esc(info.period)+' · 查核 '+esc(info.checked)+'</p><a href="'+esc(info.source)+'" target="_blank" rel="noopener noreferrer" style="color:#8ed8ff">'+esc(info.sourceType)+'來源</a></details>';
  }
  function revenueTurnaround(revenue,quote){
    if(!revenue||!quote||!Number.isFinite(revenue.yoy)||!Number.isFinite(revenue.previous_yoy))return null;
    const [year,month]=revenue.month.split('-').map(Number),expected=(month===1?year-1:year)+'-'+String(month===1?12:month-1).padStart(2,'0');
    const turnaround=revenue.previous_yoy<0&&revenue.yoy>0;
    const acceleration=revenue.previous_yoy>0&&revenue.yoy>revenue.previous_yoy;
    if(revenue.previous_month!==expected||!(turnaround||acceleration))return null;
    const bars=quote.bars;if(!Number.isFinite(bars.at(-1)?.volume)||bars.at(-1).volume<500)return null;
    if(bars.length<240||bars.slice(-240).some(b=>!Number.isFinite(b.close)||b.close<=0))return null;
    const annual=bars.slice(-240).reduce((sum,b)=>sum+b.close,0)/240,gap=bars.at(-1).close/annual-1;
    return Math.abs(gap)<=.10+1e-9?{annual,gap,route:turnaround?'由負轉正':'正成長加速'}:null;
  }
  function sustainedPositive(revenue,quote){
    if(!revenue||!quote)return null;
    const [year,month]=revenue.month.split('-').map(Number),history=revenue.yoy_history||{};
    let streak=0,first=month;
    for(let m=month;m>=1;m--){
      const key=year+'-'+String(m).padStart(2,'0');
      if(!Number.isFinite(history[key])||history[key]<=0)break;
      streak++;first=m;
    }
    if(streak<2)return null;
    const before=first===1?(year-1)+'-12':year+'-'+String(first-1).padStart(2,'0');
    if(!Number.isFinite(history[before])||history[before]>=0)return null;
    const bars=quote.bars;
    if(bars.length<240||!Number.isFinite(bars.at(-1).volume)||bars.at(-1).volume<500||bars.slice(-240).some(b=>!Number.isFinite(b.close)||b.close<=0))return null;
    const annual=bars.slice(-240).reduce((sum,b)=>sum+b.close,0)/240,gap=bars.at(-1).close/annual-1;
    return Math.abs(gap)<=.10+1e-9?{annual,gap,streak,turned:year+'-'+String(first).padStart(2,'0')}:null;
  }
  function revenueSectorStrength(groups,stocks){
    const dates=[...new Set([...stocks.values()].flatMap(s=>s.bars.slice(-6).map(b=>b.date)))].sort().slice(-6),end=dates.at(-1),start=dates[0];
    const members=new Map(),ranked=[];
    for(const [name,codes] of groups){
      const returns=[];
      for(const code of new Set(codes)){
        if(!members.has(code))members.set(code,[]);
        const stock=stocks.get(code),bars=stock?.bars||[],first=bars.find(b=>b.date===start),last=bars.at(-1);
        if(dates.length===6&&last?.date===end&&Number.isFinite(first?.close)&&first.close>0&&Number.isFinite(last.close)&&last.close>0)returns.push(last.close/first.close-1);
      }
      if(returns.length>=3)ranked.push({name,value:average(returns),coverage:returns.length});
    }
    ranked.sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
    ranked.forEach((g,i)=>{
      const same=ranked.filter(t=>Math.abs(t.value-g.value)<1e-12),first=ranked.findIndex(t=>t===same[0]),rank=first+(same.length+1)/2;
      const position=ranked.length>1?(rank-1)/(ranked.length-1):.5;
      Object.assign(g,{rank,total:ranked.length,bucket:position<=.2?'strong':position>=.8?'weak':'normal'});
    });
    const ranking=new Map(ranked.map(g=>[g.name,g]));
    for(const [name,codes] of groups)for(const code of new Set(codes)){
      if(!members.has(code))members.set(code,[]);
      members.get(code).push(ranking.get(name)||{name,bucket:'unknown'});
    }
    // Enrich unmapped candidates with existing taxonomy without changing the hot-sector universe.
    for(const [code,stock] of stocks){
      if(members.get(code)?.length)continue;
      const business=REVENUE_BUSINESS[code];
      if(business){members.set(code,[{name:business.category,bucket:'unknown',classification:business.sourceType+' · 強弱待補'}]);continue;}
      const taxonomy=typeof STOCK_GROUPS==='undefined'?[]:STOCK_GROUPS.filter(g=>g.theme!=='自訂族群'&&g.codes.includes(code));
      const names=[...new Set(taxonomy.map(g=>g.sub))];
      if(names.length)members.set(code,names.map(name=>({name,bucket:'unknown',classification:'既有產業鏈分類'})));
      else if(stock.industry)members.set(code,[{name:stock.industry,bucket:'unknown',classification:'官方產業'}]);
    }
    return {members,start,end};
  }
  function revenueGroupedCards(rows,card,strength){
    const buckets=[['strong','強勢族群','#ffd66e'],['normal','一般族群','#dce5ef'],['weak','弱勢族群','#8ed8ff'],['unknown','業務分類／強弱待補','#b9c4d0']];
    const entries=rows.map(stock=>{
      const all=(strength.members.get(stock.code)||[]).slice().sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity));
      return {stock,all,bucket:all.find(g=>Number.isFinite(g.rank))?.bucket||'unknown'};
    });
    const entryHtml=({stock,all})=>'<div style="min-width:0">'+card(stock)+'<p style="color:#dce5ef;overflow-wrap:anywhere">'+(all.length?all.map(g=>esc(g.name)+(Number.isFinite(g.rank)?' #'+Number(g.rank.toFixed(1))+'/'+g.total+' · 5日 '+percent(g.value*100):' · '+(g.classification||'族群強弱資料不足'))).join('<br>'):'尚無對應細分族群')+'</p>'+revenueBusinessDetails(stock)+'</div>';
    return '<p style="color:#dce5ef">族群近5日漲幅排名 · '+esc(strength.start||'—')+'～'+esc(strength.end||'—')+'</p>'+
      buckets.map(([key,label,color])=>{
        const selected=entries.filter(e=>e.bucket===key);
        let content=selected.map(entryHtml).join('');
        if(key==='unknown'){
          const categories=new Map();
          for(const entry of selected){
            const name=REVENUE_BUSINESS[entry.stock.code]?.category||entry.all[0]?.name||'業務待查核';
            if(!categories.has(name))categories.set(name,[]);
            categories.get(name).push(entry);
          }
          content=[...categories].map(([name,members])=>'<details open style="grid-column:1/-1;min-width:0;border:1px solid #344052;border-radius:8px;padding:10px"><summary style="font-weight:800;color:#ffe298;cursor:pointer">'+esc(name)+' · '+members.length+' 檔</summary><div class="revenue-members" style="margin-top:10px">'+members.map(entryHtml).join('')+'</div></details>').join('');
        }
        return '<details open style="grid-column:1/-1;min-width:0;border:1px solid #746346;border-radius:10px;padding:12px;margin-top:10px"><summary style="color:'+color+';font-size:17px;font-weight:800;cursor:pointer">'+label+' · '+selected.length+' 檔<span style="font-size:13px;margin-left:10px;color:#dce5ef">展開／收合</span></summary><div class="revenue-members" style="margin-top:12px">'+content+'</div></details>';
      }).join('');
  }
  window.renderRevenue = function renderRevenueRadar() {
    const root = $('revenue');
    if (!root) return;
    const groups = window.getHotSectorGroups?.() || new Map();
    const stockIndex = new Map(analyses.map(stock => [stock.code, stock]));
    const turns=Object.entries(report?.stocks||{}).filter(([,r])=>market==='all'||r.market===market).map(([code,revenue])=>({code,revenue,quote:stockIndex.get(code),name:revenue.name,result:revenueTurnaround(revenue,stockIndex.get(code))})).filter(s=>s.result&&(!query|| (s.code+' '+s.name).toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>(b.quote.score??-1)-(a.quote.score??-1)||a.code.localeCompare(b.code));
    const sustained=Object.entries(report?.stocks||{}).filter(([,r])=>market==='all'||r.market===market).map(([code,revenue])=>({code,revenue,quote:stockIndex.get(code),name:revenue.name,result:sustainedPositive(revenue,stockIndex.get(code))})).filter(s=>s.result&&(!query||(s.code+' '+s.name).toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>(b.quote.score??-1)-(a.quote.score??-1)||a.code.localeCompare(b.code));
    const sectorStrength=revenueSectorStrength(groups,stockIndex);
    const sectors = [...groups].map(([name, codes]) => {
      const members = [...codes].map(code => {
        const quote = stockIndex.get(code);
        const revenue = report?.stocks?.[code];
        return { code, name: quote?.name || revenue?.name || code, quote, revenue };
      }).filter(stock => stock.revenue && (market === 'all' || stock.revenue.market === market));
      const values = members.map(stock => stock.revenue.yoy);
      const monthlyValues = members.map(stock => stock.revenue.mom).filter(value => value != null);
      const positive = values.filter(value => value > 0).length;
      return { name, members, coverage: members.length, total: codes.size,
        avg: values.length ? average(values) : null,
        avgMom: monthlyValues.length ? average(monthlyValues) : null,
        positiveShare: values.length ? positive / values.length * 100 : null };
    }).sort((a, b) => (b.avg ?? -Infinity) - (a.avg ?? -Infinity));
    const term = query.trim().toLowerCase();
    const matchingStocks = term && report ? Object.entries(report.stocks)
      .filter(([code, revenue]) => `${code} ${revenue.name}`.toLowerCase().includes(term))
      .map(([code, revenue]) => ({ code, name: revenue.name || stockIndex.get(code)?.name || code, revenue, quote: stockIndex.get(code) }))
      .sort((a, b) => a.code.localeCompare(b.code, 'zh-Hant')) : [];
    const visible = sectors.filter(sector => !term || sector.name.toLowerCase().includes(term)
      || sector.members.some(stock => `${stock.name} ${stock.code}`.toLowerCase().includes(term)));
    const ranked = sectors.filter(sector => sector.coverage >= 3).slice(0, 5);
    root.innerHTML = `<div class="sector-heading"><h1>營收成長雷達</h1><p>最新官方月報 ${esc(report?.month || '載入中')} · 沿用族群輪動雷達的細分族群 · 按成員平均年增率排序</p></div>
      <div class="revenue-note">${report ? `涵蓋 ${Object.keys(report.stocks).length} 檔上市、上櫃公司；比較同一資料月份。族群平均採有公布成員的簡單平均，同一族群內的個股代號只計一次；同股可屬於不同主題。` : esc(error || '正在讀取官方月營收…')}</div>
      <details class="revenue-turns" open><summary style="color:#ffe298;font-size:20px;font-weight:800;line-height:1.5">營收轉強・年線附近 <small>${turns.length} 檔</small></summary><div class="revenue-members">${turns.length?revenueGroupedCards(turns,s=>'<article style="border:1px solid #746346;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere"><button type="button" class="revenue-stock-open" data-code="'+esc(s.code)+'" style="background:none;border:0;color:#ffe298;font-weight:700">'+esc(s.code)+' '+esc(s.name)+' ↗</button><p style="color:#dce5ef">營收月份 '+esc(s.revenue.month)+' · <strong style="color:#ffe298">'+esc(s.result.route)+'</strong>'+' · <strong style="color:#8ed8ff;font-weight:800">前月 '+percent(s.revenue.previous_yoy)+'</strong> → <strong style="color:#8ed8ff;font-weight:800">'+percent(s.revenue.yoy)+'</strong><br>收盤 '+fmt(s.quote.t.close)+' · MA240 '+fmt(s.result.annual)+' · <strong style="color:#ffb36e;font-weight:800">年線乖離 '+percent(s.result.gap*100)+'</strong><br>均線 '+(s.quote.score??'待補')+'／15 · 行情 '+esc(s.quote.t.date)+'</p></article>',sectorStrength):'<p>目前沒有資料齊全且符合的個股；缺少前月營收或240日線不列入。</p>'}</div></details>
      <details class="revenue-turns" open><summary style="color:#ffe298;font-size:20px;font-weight:800;line-height:1.5">今年轉正後持續正成長 <small>${sustained.length} 檔</small></summary><div class="revenue-members">${sustained.length?revenueGroupedCards(sustained,s=>'<article style="border:1px solid #746346;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere"><button type="button" class="revenue-stock-open" data-code="'+esc(s.code)+'" style="background:none;border:0;color:#ffe298;font-weight:700">'+esc(s.code)+' '+esc(s.name)+' ↗</button><p style="color:#dce5ef"><strong style="color:#8ed8ff">'+esc(s.result.turned)+' 轉正 · 連續 '+s.result.streak+' 個月年增為正</strong><br>最新營收 '+esc(s.revenue.month)+' · <strong style="color:#8ed8ff">'+percent(s.revenue.yoy)+'</strong><br>收盤 '+fmt(s.quote.t.close)+' · MA240 '+fmt(s.result.annual)+' · <strong style="color:#ffb36e">年線乖離 '+percent(s.result.gap*100)+'</strong><br>均線 '+(s.quote.score??'待補')+'／15 · 行情 '+esc(s.quote.t.date)+'</p></article>',sectorStrength):'<p>目前沒有資料齊全且符合的個股；須今年曾由負轉正、連續至少2個月直到最新月年增率皆＞0、年線±10%、成交量≥500張。缺月不跨月補算。</p>'}</div></details>
      ${report ? `<details class="revenue-leaders" ${leadersOpen ? 'open' : ''}><summary>營收成長前五名族群 <small>依平均年增率排序</small></summary><div class="revenue-leader-grid">${ranked.map((sector, rank) => `<div><small>第 ${rank + 1} 名</small><strong>${esc(sector.name)}</strong><span>平均年增 <b>${percent(sector.avg)}</b></span><span>平均月增 <b>${percent(sector.avgMom)}</b></span><span>${sector.coverage} 家公布 · ${sector.positiveShare.toFixed(0)}% 年增為正</span></div>`).join('')}</div></details>` : ''}
      <div class="revenue-toolbar"><button type="button" id="revenue-positive" class="${positiveOnly ? 'active' : ''}">${positiveOnly ? '只看年增為正' : '顯示全部已公布'}</button><label>市場 <select id="revenue-market"><option value="all">上市＋上櫃</option><option value="上市">上市</option><option value="上櫃">上櫃</option></select></label><form id="revenue-search-form" class="revenue-search-form"><label for="revenue-search">搜尋</label><input id="revenue-search" type="search" placeholder="族群、股號或名稱" value="${esc(query)}"><button type="submit" id="revenue-search-confirm">確認</button></form></div>
      <dialog id="revenue-search-dialog" class="revenue-search-dialog" aria-labelledby="revenue-search-title"><div class="revenue-search-dialog-head"><div><h2 id="revenue-search-title">個股營收資訊</h2><p>官方月報 ${esc(report?.month || '—')} · ${matchingStocks.length} 筆結果</p></div><button type="button" id="revenue-search-close" aria-label="關閉營收資訊">× 返回</button></div><div class="revenue-members">${matchingStocks.length ? matchingStocks.map(searchCard).join('') : `<p>${report ? `目前官方月報沒有符合「${esc(query)}」的營收資料。` : '正在讀取官方月營收…'}</p>`}</div></dialog>
      ${visible.map((sector, index) => {
        const stocks = sector.members.filter(stock => !positiveOnly || stock.revenue.yoy > 0)
          .filter(stock => !term || sector.name.toLowerCase().includes(term) || `${stock.name} ${stock.code}`.toLowerCase().includes(term))
          .sort((a, b) => b.revenue.yoy - a.revenue.yoy);
        return `<details class="sector-theme revenue-theme" ${index < 2 || term ? 'open' : ''}><summary>${esc(sector.name)} <small>${sector.avg == null ? '尚無營收' : `平均年增 ${percent(sector.avg)} · 正成長 ${sector.positiveShare.toFixed(0)}% · ${sector.coverage}/${sector.total} 家公布`}</small></summary>
          <div class="revenue-members">${stocks.length ? stocks.map(stockCard).join('') : '<p>此條件下沒有已公布的成員。</p>'}</div></details>`;
      }).join('')}
      <p class="revenue-source">資料來源：<a href="https://data.gov.tw/dataset/18420" target="_blank" rel="noopener">上市月營收</a>、<a href="https://data.gov.tw/dataset/56510" target="_blank" rel="noopener">上櫃月營收</a>。月報更新時間可能晚於個別公司的公告，未公布或缺漏不當作零。</p>`;
    root.querySelector('#revenue-positive').onclick = () => { positiveOnly = !positiveOnly; renderRevenue(); };
    root.querySelector('.revenue-leaders')?.addEventListener('toggle', event => { leadersOpen = event.target.open; });
    root.querySelector('#revenue-market').value = market;
    root.querySelector('#revenue-market').onchange = event => { market = event.target.value; renderRevenue(); };
    root.querySelector('#revenue-search-form').onsubmit = event => {
      event.preventDefault();
      query = root.querySelector('#revenue-search').value.trim();
      renderRevenue();
      root.querySelector('#revenue-search-dialog').showModal();
    };
    root.querySelector('#revenue-search-close').onclick = () => root.querySelector('#revenue-search-dialog').close();
    root.querySelectorAll('.revenue-stock-open').forEach(button => button.onclick = () => {
      const stock = stockIndex.get(button.dataset.code);
      root.querySelector('#revenue-search-dialog').close();
      if (stock) openStockDetail(stock, root.querySelector('#revenue-search-confirm'));
    });
    root.querySelectorAll('.revenue-stock:not(:disabled)').forEach(button => button.onclick = () => {
      const stock = stockIndex.get(button.dataset.code);
      if (stock) openStockDetail(stock, button);
    });
  };

  fetch('revenue-data.json?v=' + Date.now(), { cache: 'no-store' })
    .then(response => { if (!response.ok) throw Error('營收快照尚未建立'); return response.json(); })
    .then(data => { if (!data.stocks || !data.month) throw Error('營收資料格式錯誤'); report = data; })
    .catch(cause => { error = `營收讀取失敗：${cause.message}`; })
    .finally(() => { if (!$('revenue').hidden) renderRevenue(); });
})();


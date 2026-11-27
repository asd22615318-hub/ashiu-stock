"""Phase 1: non-destructive stock universe and auditable industry taxonomy."""
import datetime as dt
import json
import os
from pathlib import Path

SCHEMA_VERSION = 1
CATEGORIES = {
 "semiconductor": ("半導體", ["IC設計","晶圓代工","矽晶圓","先進封裝","封裝測試","半導體材料","半導體設備","ASIC","IP矽智財","功率半導體"]),
 "pcb": ("PCB／載板", ["硬板","軟板","HDI","ABF載板","BT載板","銅箔基板","銅箔","玻纖布","玻纖紗","鑽針","PCB設備","PCB化學材料"]),
 "passive": ("被動元件", ["MLCC","晶片電阻","電感","鉭質電容","鋁質電容","固態電容","薄膜電容","保護元件","陶瓷粉體"]),
 "memory": ("記憶體", ["DRAM","NAND Flash","NOR Flash","記憶體模組","SSD","記憶體控制IC","記憶體封測"]),
 "photonics": ("光通訊／矽光子", ["光收發模組","矽光子PIC","CPO","光通訊晶片","光纖連接器","光纖線材","雷射光源"]),
 "ai_server": ("AI伺服器", ["伺服器ODM","GPU伺服器","機櫃整合","液冷散熱","氣冷散熱","電源供應","BBU","高速連接器"]),
 "components": ("電子零組件", ["連接器","線束","石英元件","導線架","散熱模組","機構件"]),
 "optics": ("光學／鏡頭", ["手機鏡頭","車用鏡頭","安控鏡頭","光學鏡片","AR／VR光學","光學鍍膜"]),
 "display": ("面板／顯示", ["LCD","OLED","Micro LED","Mini LED","面板驅動IC","偏光片","觸控面板"]),
 "energy": ("電力／能源", ["重電","變壓器","電網工程","儲能系統","電池材料","太陽能","風電","充電樁"]),
 "automotive": ("車用電子", ["車用IC","ADAS","車用PCB","車用被動元件","功率元件","車用連接器"]),
 "robotics": ("機器人／自動化", ["工業機器人","協作機器人","減速機","伺服馬達","線性滑軌","滾珠螺桿"]),
 "network": ("網通／通訊", ["交換器","路由器","Wi-Fi 7","5G設備","低軌衛星","衛星通訊"]),
 "shipping": ("航運／運輸", ["貨櫃航運","散裝航運","油輪","航空客運","航空貨運","物流"]),
 "chemical": ("塑化／化工", ["石化上游","塑膠原料","特用化學","電子化學品","工業氣體","工程塑膠"]),
 "metals": ("鋼鐵／金屬", ["鋼鐵","不鏽鋼","特殊鋼","鋁材","銅材","金屬加工"]),
 "biotech": ("生技醫療", ["新藥研發","學名藥","原料藥","醫療器材","檢測試劑","CDMO"]),
 "defense": ("軍工／航太", ["無人機","航太零組件","軍用通訊","船艦製造","國防電子"]),
 "traditional": ("金融／傳產", ["金控","銀行","保險","證券","營建","水泥","食品","紡織","百貨","觀光"]),
 "software": ("資訊／軟體", ["雲端服務","系統整合","AI軟體","資安","金融科技","遊戲","電子商務"])
}
OFFICIAL = {
 "上市": "https://openapi.twse.com.tw/v1/opendata/t187ap03_L",
 "上櫃": "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O"
}

def nodes():
    out = []
    for key,(name,children) in CATEGORIES.items():
        out.append({"id":key,"parent_id":None,"name":name,"level":1,"kind":"curated_taxonomy"})
        for i,child in enumerate(children,1):
            out.append({"id":f"{key}.{i:02d}","parent_id":key,"name":child,"level":2,"kind":"product_or_process"})
    return out

def normalize(snapshot, evidence=None):
    if not isinstance(snapshot,dict) or not isinstance(snapshot.get("stocks"),list):
        raise ValueError("Missing market snapshot")
    evidence = evidence or []
    stocks = {}
    for item in snapshot["stocks"]:
        code = str(item.get("code","")).strip()
        market = item.get("market")
        if not code or market not in OFFICIAL or not item.get("name"):
            continue
        key = f"{market}:{code}"
        if key in stocks:
            raise ValueError(f"Duplicate stock: {key}")
        stocks[key] = {"id":key,"code":code,"name":item["name"],"market":market,
            "official_industry":item.get("industry") or "未分類",
            "official_source":OFFICIAL[market],"classification_status":"pending_product_review"}
    ids = {node["id"] for node in nodes()}
    links = []
    seen = set()
    for item in evidence:
        stock_id,industry_id = item["stock_id"],item["industry_id"]
        if stock_id not in stocks or industry_id not in ids:
            raise ValueError("Invalid stock or industry reference")
        if not item.get("source_url") or not item.get("reviewed_at") or item.get("status") != "verified":
            raise ValueError("Product classification requires verified evidence and review date")
        key=(stock_id,industry_id)
        if key in seen: raise ValueError("Duplicate industry link")
        seen.add(key)
        links.append({k:item[k] for k in ("stock_id","industry_id","source_url","reviewed_at","status")})
    return {"schema_version":SCHEMA_VERSION,"snapshot_updated_at":snapshot.get("updated_at"),
        "stocks":list(stocks.values()),"industries":nodes(),"stock_industries":links,
        "coverage":{"stocks":len(stocks),"product_verified_stocks":len({v["stock_id"] for v in links}),
        "product_pending_stocks":len(stocks)-len({v["stock_id"] for v in links})}}

def publish(snapshot_path, output_path, evidence_path=None):
    snapshot=json.loads(Path(snapshot_path).read_text(encoding="utf-8"))
    evidence=json.loads(Path(evidence_path).read_text(encoding="utf-8")) if evidence_path and Path(evidence_path).exists() else []
    result=normalize(snapshot,evidence)
    output=Path(output_path)
    output.parent.mkdir(parents=True,exist_ok=True)
    tmp=output.with_suffix(".tmp")
    tmp.write_text(json.dumps(result,ensure_ascii=False,separators=(",",":"),allow_nan=False),encoding="utf-8")
    os.replace(tmp,output)
    return result

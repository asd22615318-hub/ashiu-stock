"""Download and normalize the official listed/OTC monthly revenue reports."""
import csv
import io
import json
import math
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCES = {
    '上市': 'https://mopsfin.twse.com.tw/opendata/t187ap05_L.csv',
    '上櫃': 'https://mopsfin.twse.com.tw/opendata/t187ap05_O.csv',
}


def number(value):
    try:
        result = float(str(value).replace(',', '').strip())
    except (TypeError, ValueError):
        return None
    return round(result, 2) if math.isfinite(result) else None


def fetch_report(market, url):
    with urllib.request.urlopen(url, timeout=45) as response:
        raw = response.read()
    rows = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
    if len(rows) < 300:
        raise ValueError(f'Incomplete {market} revenue report: {len(rows)} rows')
    normalized = {}
    for row in rows:
        code = row.get('公司代號', '').strip()
        roc_month = row.get('資料年月', '').strip()
        if not code.isdigit() or len(roc_month) != 5 or not roc_month.isdigit():
            continue
        month = f'{int(roc_month[:3]) + 1911}-{roc_month[3:]}'
        yoy = number(row.get('營業收入-去年同月增減(%)'))
        mom = number(row.get('營業收入-上月比較增減(%)'))
        ytd_yoy = number(row.get('累計營業收入-前期比較增減(%)'))
        if yoy is None:
            continue
        normalized[code] = {
            'name': row.get('公司名稱', '').strip(),
            'market': market,
            'month': month,
            'yoy': yoy,
            'mom': mom,
            'ytd_yoy': ytd_yoy,
        }
    return normalized


def update(root: Path, public: Path, offline=False):
    seed = root / 'revenue-seed.json'
    if offline:
        data = json.loads(seed.read_text(encoding='utf-8'))
    else:
        stocks = {}
        for market, url in SOURCES.items():
            stocks.update(fetch_report(market, url))
        if len(stocks) < 1000:
            raise ValueError(f'Incomplete combined revenue report: {len(stocks)} stocks')
        months = sorted({stock['month'] for stock in stocks.values()})
        latest = months[-1]
        stocks = {code: stock for code, stock in stocks.items() if stock['month'] == latest}
        data = {
            'month': latest,
            'updated_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'sources': list(SOURCES.values()),
            'stocks': stocks,
        }
        seed.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    output = public / 'revenue-data.json'
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return data


if __name__ == '__main__':
    base = Path(__file__).resolve().parent
    result = update(base, base / 'dist')
    print(json.dumps({'month': result['month'], 'stocks': len(result['stocks'])}))


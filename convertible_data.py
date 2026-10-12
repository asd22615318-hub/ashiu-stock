"""Build a monthly convertible-bond custody snapshot from TDCC open data."""
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = 'https://openapi.tdcc.com.tw/v1/opendata/2-8'
ISSUES_URL = 'https://www.tpex.org.tw/openapi/v1/bond_ISSBD5_data'
PRICES_URL = 'https://openapi.tdcc.com.tw/v1/opendata/1-13'


def date(value):
    digits = re.findall(r'\d+', str(value or ''))
    if len(digits) >= 3:
        year, month, day = map(int, digits[:3])
    elif len(digits) == 1 and len(digits[0]) in (7, 8):
        raw = digits[0]
        year, month, day = int(raw[:-4]), int(raw[-4:-2]), int(raw[-2:])
    else:
        return ''
    if year < 1911:
        year += 1911
    try:
        return datetime(year, month, day).date().isoformat()
    except ValueError:
        return ''


def price(value):
    try:
        result = float(str(value).replace(',', '').strip())
        return result if result > 0 else None
    except (TypeError, ValueError):
        return None


def fetch_json(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'ashiu-stock/1.0 (public data)', 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def enrich(bonds, issues, changes, today=None):
    today = today or datetime.now(timezone.utc).date().isoformat()
    issue_by_code = {}
    existing = {bond['code'] for bond in bonds}
    for row in issues:
        code = str(row.get('BondCode', '')).strip()
        underlying = str(row.get('IssuerCode', '')).strip()
        maturity = date(row.get('MaturityDate'))
        if '交換' in str(row.get('BondType', '')) or not re.fullmatch(r'\d{4}[0-9A-Z]{1,3}', code) or not re.fullmatch(r'\d{4}', underlying) or not maturity or maturity < today:
            continue
        outstanding = number(row.get('OutstandingAmount'))
        if outstanding is not None and outstanding <= 0:
            continue
        issue_price = price(row.get('Conversion/ExchangePriceAtIssuance'))
        if code not in existing:
            bonds.append({'code': code, 'name': str(row.get('ShortName') or code).strip(), 'underlying_code': underlying,
                          'custody': None, 'prior': None, 'change': None, 'issued': None, 'holders': None})
            existing.add(code)
        issue_by_code[code] = {
            'maturity_date': maturity,
            'conversion_end_date': date(row.get('Conversion/ExchangePeriodEndDate')),
            'issue_conversion_price': issue_price,
            'outstanding_amount': outstanding,
        }
    latest_change = {}
    for row in changes:
        code = str(row.get('證券代號', '')).strip()
        changed_at = date(row.get('資料日期'))
        changed_price = price(row.get('轉(交)換價格'))
        if code not in issue_by_code or not changed_at or changed_at > today or changed_price is None:
            continue
        if code not in latest_change or changed_at > latest_change[code][0]:
            latest_change[code] = (changed_at, changed_price)
    for bond in bonds:
        issue = issue_by_code.get(bond['code'])
        if not issue:
            continue
        bond.update(issue)
        change = latest_change.get(bond['code'])
        if change:
            bond['conversion_price'] = change[1]
            bond['conversion_price_date'] = change[0]
            bond['conversion_price_kind'] = 'announced_change'
        elif issue['issue_conversion_price'] is not None:
            bond['conversion_price'] = issue['issue_conversion_price']
            bond['conversion_price_kind'] = 'at_issuance'
    return bonds


def number(value):
    if value is None or str(value).strip() in ('', '-', '—', 'N/A'):
        return None
    try:
        return int(round(float(str(value).replace(',', '').replace('%', '').strip())))
    except ValueError:
        return None


def period(value):
    digits = re.sub(r'\D', '', str(value or ''))
    if len(digits) >= 6 and int(digits[:4]) > 1900:
        return f'{digits[:4]}-{digits[4:6]}'
    if len(digits) >= 5:
        return f'{int(digits[:3]) + 1911:04d}-{digits[3:5]}'
    return ''


def parse(rows):
    if not isinstance(rows, list):
        raise ValueError('TDCC response is not a list')
    months = {}
    for raw in rows:
        row = {str(k).lstrip('\ufeff').strip(): v for k, v in raw.items()}
        month = period(row.get('資料年月'))
        code = str(row.get('可轉換公司債代號', '')).strip()
        if not month or not re.fullmatch(r'[0-9A-Z]{5,7}', code):
            continue
        bond = {
            'code': code,
            'name': str(row.get('可轉換公司債名稱', '')).strip(),
            'underlying_code': code[:4] if code[:4].isdigit() else '',
            'custody': number(row.get('本月底保管張數')),
            'prior': number(row.get('前月底保管張數')),
            'change': number(row.get('增減數額')),
            'issued': number(row.get('發行張數')),
            'holders': number(row.get('集保股東戶數')),
        }
        if bond['custody'] is not None and bond['custody'] >= 0:
            months.setdefault(month, {})[code] = bond
    if not months:
        raise ValueError('TDCC response has no valid convertible bonds')
    latest = max(months)
    bonds = list(months[latest].values())
    if len(bonds) < 50:
        raise ValueError(f'Incomplete TDCC month: {latest}, {len(bonds)} bonds')
    return {'period': latest, 'source': URL, 'updated_at': datetime.now(timezone.utc).isoformat(), 'bonds': bonds}


def update(root: Path, public: Path):
    data = parse(fetch_json(URL))
    issues = fetch_json(ISSUES_URL)
    changes = fetch_json(PRICES_URL)
    if not isinstance(issues, list) or not isinstance(changes, list):
        raise ValueError('Convertible bond issue or price response is not a list')
    enrich(data['bonds'], issues, changes)
    import cb_daily
    import market_data
    market = market_data.read_snapshot()
    calendar = {bar['date'] for stock in market.get('stocks', [])
                for bar in stock.get('bars', []) if bar.get('date')}
    previous = json.loads((root / 'convertible-seed.json').read_text(encoding='utf-8'))
    data['daily'] = cb_daily.collect(data['bonds'], calendar,
                                      previous.get('bonds', []))
    data['issue_source'] = ISSUES_URL
    data['price_source'] = PRICES_URL
    text = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    (public / 'convertible-data.json').write_text(text, encoding='utf-8')
    (root / 'convertible-seed.json').write_text(text, encoding='utf-8')
    print('Convertible bonds:', data['period'], len(data['bonds']))


if __name__ == '__main__':
    base = Path(__file__).resolve().parent
    update(base, base / 'dist')


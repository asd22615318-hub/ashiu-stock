"""Build a monthly convertible-bond custody snapshot from TDCC open data."""
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = 'https://openapi.tdcc.com.tw/v1/opendata/2-8'


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
    request = urllib.request.Request(URL, headers={'User-Agent': 'ashiu-stock/1.0 (public data)'})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = parse(json.load(response))
    text = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    (public / 'convertible-data.json').write_text(text, encoding='utf-8')
    (root / 'convertible-seed.json').write_text(text, encoding='utf-8')
    print('Convertible bonds:', data['period'], len(data['bonds']))


if __name__ == '__main__':
    base = Path(__file__).resolve().parent
    update(base, base / 'dist')


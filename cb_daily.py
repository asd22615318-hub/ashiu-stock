"""Collect TPEx convertible-bond daily quotes and trading units."""
import concurrent.futures
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import date, datetime

URL = 'https://www.tpex.org.tw/www/zh-tw/bond/cbDayQry'
REFERER = 'https://www.tpex.org.tw/zh-tw/bond/info/statistics-cb/day-quotes.html'


def number(value):
    try:
        return float(str(value).replace(',', '').strip())
    except (TypeError, ValueError):
        return None


def iso_date(value):
    digits = re.sub(r'\D', '', str(value))
    if len(digits) != 7:
        return None
    try:
        return date(int(digits[:3]) + 1911, int(digits[3:5]), int(digits[5:])).isoformat()
    except ValueError:
        return None


def parse_month(payload):
    if payload.get('stat') != 'ok' or not payload.get('tables'):
        raise ValueError('TPEx CB daily response is not ok')
    table = payload['tables'][0]
    fields = table.get('fields', [])
    required = ['日期', '交易模式', '收市價', '單位']
    if any(field not in fields for field in required):
        raise ValueError('TPEx CB daily columns changed')
    indexes = {field: fields.index(field) for field in required}
    by_date = {}
    for row in table.get('data', []):
        day = iso_date(row[indexes['日期']])
        if not day:
            continue
        mode = str(row[indexes['交易模式']]).strip()
        if mode not in ('等價', '議價'):
            continue
        units = number(row[indexes['單位']])
        close = number(row[indexes['收市價']])
        if units is None and close is None:
            continue
        if units is None or units < 0 or int(units) != units:
            raise ValueError('Invalid TPEx CB trading units')
        item = by_date.setdefault(day, {'date': day, 'volume': 0, 'close': None})
        item['volume'] += int(units)
        if close is not None and (mode == '等價' or item['close'] is None):
            item['close'] = close
    return by_date


def fetch_month(code, month):
    body = urllib.parse.urlencode({
        'date': month.strftime('%Y/%m/01'), 'code': code, 'id': '', 'response': 'json'
    }).encode()
    request = urllib.request.Request(URL, data=body, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; ashiu-stock/1.0)',
        'Accept': 'application/json', 'Referer': REFERER,
    })
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                return parse_month(json.load(response))
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def months_to_fetch(previous_bars, now):
    first = date(now.year, now.month, 1)
    if previous_bars:
        return [first]
    months = []
    year, month = first.year, first.month
    for _ in range(3):
        months.append(date(year, month, 1))
        year, month = (year - 1, 12) if month == 1 else (year, month - 1)
    return months


def collect(bonds, calendar, previous_bonds=None, now=None, workers=8):
    now = now or date.today()
    previous = {bond['code']: bond for bond in (previous_bonds or [])}
    active = [bond for bond in bonds if bond.get('maturity_date', '') >= now.isoformat()]
    tasks = [(bond['code'], month) for bond in active
             for month in months_to_fetch(previous.get(bond['code'], {}).get('daily_bars'), now)]
    received, failures = {}, set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_month, code, month): (code, month) for code, month in tasks}
        for future in concurrent.futures.as_completed(futures):
            code, month = futures[future]
            try:
                received.setdefault(code, {}).update(future.result())
            except Exception as exc:
                failures.add(code)
                print(f'CB daily fetch failed: {code} {month:%Y-%m}: {exc}')
    if active and len(received) < max(1, int(len(active) * .7)):
        raise ValueError(f'TPEx CB daily coverage too low: {len(received)}/{len(active)}')
    latest = max((day for rows in received.values() for day in rows), default='')
    session_dates = sorted({day for day in calendar if day <= latest})[-80:]
    for bond in bonds:
        code = bond['code']
        old = previous.get(code, {}).get('daily_bars') or []
        if code in failures or code not in received:
            if old:
                bond['daily_bars'] = old
            continue
        merged = {bar['date']: bar for bar in old}
        merged.update(received[code])
        # Missing quote rows on a market session mean zero CB units, not a missing session.
        bond['daily_bars'] = [merged.get(day, {'date': day, 'volume': 0, 'close': None})
                              for day in session_dates]
    return {'source': URL, 'as_of': latest, 'covered': len(received),
            'active': len(active), 'failed': len(failures), 'units': 'NT$100,000 face value'}


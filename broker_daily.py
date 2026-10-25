"""Persist date-verified single-session Top-15 channel concentration."""
import argparse
import concurrent.futures
import gzip
import json
import math
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from broker_data import BASE, parse_report


def daily_row(report, bar):
    day = bar['date']
    if report.get('start') != day or report.get('end') != day or report.get('unit') != 'lots' or report.get('top_n') != 15:
        raise ValueError('Not a date-matched single-session Top-15 report')
    if len(report.get('buyers', [])) != 15 or len(report.get('sellers', [])) != 15:
        raise ValueError('Incomplete Top-15 sides')
    buy, sell, net, volume = (report.get('buy_lots'), report.get('sell_lots'), report.get('net_lots'), bar.get('volume'))
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (buy, sell, net, volume)) or min(buy, sell) < 0 or volume <= 0:
        raise ValueError('Invalid lots or daily volume')
    if abs(buy - sell - net) > .01:
        raise ValueError('Aggregate arithmetic mismatch')
    return dict(date=day, top_n=15, buy_lots=buy, sell_lots=sell, net_lots=net,
                volume_lots=volume, concentration_pct=net / volume * 100,
                unit='lots', source=report['source'])


def update(root, market_path=None, days=1, workers=3):
    root = Path(root)
    market = json.loads(gzip.decompress(Path(market_path or root/'seed.json.gz').read_bytes()))
    dates = sorted({b['date'] for s in market['stocks'] for b in s.get('bars', [])})[-max(1, days):]
    target = root/'broker-daily-seed.json'
    prior = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {}
    sessions = {s['date']: s for s in prior.get('sessions', [])}
    cache_path = root/'overnight-cache.json'
    cached = json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else {}
    for day in dates:
        universe = [(s, next(b for b in s['bars'] if b['date'] == day)) for s in market['stocks']
                    if s.get('market') in ('上市', '上櫃') and any(b['date'] == day and b.get('volume', 0) > 0 for b in s.get('bars', []))]
        previous = sessions.get(day, {})
        rows = dict(previous.get('stocks', {}))
        # A later quote snapshot may correct the daily volume.
        for stock, bar in universe:
            saved = rows.get(stock['code'])
            if saved and saved.get('date') == day and saved.get('unit') == 'lots':
                saved['volume_lots'] = bar['volume']
                saved['concentration_pct'] = saved['net_lots'] / bar['volume'] * 100
        errors = {}
        # Reuse only validated same-day reports collected by the existing job.
        if cached.get('date') == day:
            for stock, bar in universe:
                report = cached.get('reports', {}).get(stock['code'])
                if report and stock['code'] not in rows:
                    try:
                        rows[stock['code']] = daily_row(report, bar)
                    except (ValueError, KeyError):
                        pass
        def fetch(item):
            stock, bar = item
            url = BASE + '?' + urllib.parse.urlencode(dict(a=stock['code'], e=day, f=day))
            time.sleep(.4)
            request = urllib.request.Request(url, headers={'User-Agent': 'AshiuStockResearch/1.0'})
            with urllib.request.urlopen(request, timeout=18) as response:
                raw = response.read().decode('cp950', 'replace')
            return stock['code'], daily_row(parse_report(raw, stock['code'], day, day), bar)
        pending = [(s, b) for s, b in universe if s['code'] not in rows]
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            jobs = {pool.submit(fetch, item): item[0]['code'] for item in pending}
            for count, job in enumerate(concurrent.futures.as_completed(jobs), 1):
                code = jobs[job]
                try:
                    code, row = job.result()
                    rows[code] = row
                except Exception as exc:
                    errors[code] = str(exc)[:180]
                if count % 100 == 0:
                    print(day, count, '/', len(pending), 'valid', len(rows), flush=True)
        if not rows:
            raise ValueError('No verified daily reports; preserving existing snapshot')
        sessions[day] = dict(date=day, stocks=rows, requested=len(universe), available=len(rows), errors=errors)
        data = dict(version=1, updated_at=datetime.now(timezone.utc).isoformat(), source=BASE,
                    methodology='Single-day Top15 net-buy total minus Top15 net-sell total divided by same-day volume; lots; not investor identity',
                    sessions=sorted(sessions.values(), key=lambda s: s['date'])[-60:])
        target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        print('Completed', day, 'requested', len(universe), 'available', len(rows), 'missing', len(errors), flush=True)
    return data


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--market')
    parser.add_argument('--days', type=int, default=1)
    parser.add_argument('--workers', type=int, default=3)
    args = parser.parse_args()
    update(Path(__file__).resolve().parent, args.market, args.days, args.workers)
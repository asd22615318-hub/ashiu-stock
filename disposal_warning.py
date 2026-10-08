"""Conservative disposal-warning engine. Official announcements remain authoritative."""
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable

ELIGIBLE_KINDS = frozenset(range(1, 9))

@dataclass(frozen=True)
class AttentionDay:
    date: str
    kinds: frozenset[int]

def parse_kinds(detail: str) -> frozenset[int]:
    """Parse explicitly numbered Chinese attention clauses; never infer from prose."""
    import re
    chinese = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}
    found = set()
    for token in re.findall(r'第([一二三四五六七八九十]|[1-9]|10)款', detail or ''):
        found.add(chinese.get(token, int(token) if token.isdigit() else 0))
    return frozenset(found)

def assess_attention(days: Iterable[AttentionDay]) -> dict:
    """days: ascending trading-day observations, including explicit empty days.

    Missing sessions MUST NOT be represented as empty observations; mark history incomplete
    at the caller and do not issue a confident signal.
    """
    rows = list(days)
    flags = [bool(d.kinds & ELIGIBLE_KINDS) for d in rows]
    first = [1 in d.kinds for d in rows]
    def trailing_run(values):
        count = 0
        for flag in reversed(values):
            if not flag: break
            count += 1
        return count
    return {
        'first_kind_streak': trailing_run(first),
        'eligible_streak': trailing_run(flags),
        'eligible_last_10': sum(flags[-10:]),
        'eligible_last_30': sum(flags[-30:]),
        'triggered': (trailing_run(first)>=3 or trailing_run(flags)>=5 or
                      len(rows)>=10 and sum(flags[-10:])>=6 or
                      len(rows)>=30 and sum(flags[-30:])>=12),
        'history_sessions': len(rows),
        'history_complete_30': len(rows)>=30,
        'source': 'official_attention_history',
    }

def pct_reference_price(threshold, percent):
    """Reverse-engineer the image's displayed reference close, not a regulatory trigger."""
    return (Decimal(str(threshold))/(Decimal('1')+Decimal(str(percent))/100)).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP)

def volume_ratio(observed, threshold):
    if threshold <= 0: raise ValueError('threshold must be positive')
    return round(observed/threshold, 4)

def image_validation_cases():
    """Image-only fixtures; not official threshold verification."""
    return {
        '5228': {'reference_close': str(pct_reference_price('57.98','-5.42')),
                 'volume_ratio': volume_ratio(4797,1903)},
        '4556': {'reference_close_high': str(pct_reference_price('148.89','2.69')),
                 'reference_close_low': str(pct_reference_price('138.74','-4.31')),
                 'volume_ratio': volume_ratio(852,2115)},
        '8111': {'reference_close': str(pct_reference_price('97.16','3.69')),
                 'volume_ratio': volume_ratio(17017,5455)},
        '2492': {'reference_close_high': str(pct_reference_price('447.18','6.47')),
                 'reference_close_low': str(pct_reference_price('417.78','-0.53')),
                 'volume_ratio': volume_ratio(64554,24240)},
    }

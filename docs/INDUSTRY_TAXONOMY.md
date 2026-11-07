# Phase 1: Industry taxonomy (non-breaking)

The existing screener, sector/revenue radar, market-data and build pipeline remain unchanged.

`industry_taxonomy.py` defines 20 curated top-level groups and product/process child labels. These are **taxonomy definitions**, not claims that any company makes those products.

To generate an independent snapshot after a normal market update:

```python
from industry_taxonomy import publish
publish("dist/market-data.json", "dist/industry-taxonomy.json")
```

Use the uncompressed market-data.json during a local build, before build.py removes it. The current published gzip snapshot can also be decompressed to a temporary JSON file.

Verified product links are an optional JSON array with `stock_id` (e.g. `上市:1234`), `industry_id`, `source_url`, `reviewed_at` and `status: verified`. Do not label companies by code/name keyword matching. All unverified companies remain `pending_product_review`.

```python -m unittest discover -s tests -p 'test_industry_taxonomy.py'```

Next PR: integrate publishing in the existing build path, then research company filings and audited product links. The official industry field comes from the existing market snapshot, whose industry source is the TWSE ISIN directory; it is not a verified product classification.

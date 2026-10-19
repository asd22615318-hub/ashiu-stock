"""Publishable quote snapshot before slower auxiliary reports finish."""
import gzip
import json
from pathlib import Path
import market_data as market


def main():
    root=Path(__file__).resolve().parent
    market.PUBLIC.mkdir(exist_ok=True)
    market.SNAPSHOT.write_bytes(gzip.decompress((root/'seed.json.gz').read_bytes()))
    print(json.dumps(market.update(fast=True),ensure_ascii=True),flush=True)
    (root/'seed.json.gz').write_bytes(gzip.compress(market.SNAPSHOT.read_bytes(),mtime=0))
    try:
        import taiwan_sentiment_data
        taiwan_sentiment_data.update(root,market.PUBLIC)
    except Exception as error:
        print('Index inputs unavailable; preserve previous snapshot:',error,flush=True)


if __name__=='__main__':main()

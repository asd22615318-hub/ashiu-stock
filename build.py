"""Build the Pages artifact from public quotes only. Requires Windows Python."""
import gzip,json,os,shutil,sys,urllib.request,urllib.error
from pathlib import Path
from history_supplement import merge as merge_verified_history
if '--offline' in sys.argv:
    # The Cloudflare Linux builder deploys saved snapshots; the Windows job fetches reports.
    saved_root=Path(__file__).resolve().parent
    saved_public=saved_root/'dist'
    saved_public.mkdir(exist_ok=True)
    for source,target in [('seed.json.gz','market-data.json.gz'),('valuation-seed.json','valuation-data.json'),('institutional-seed.json','institutional-data.json'),('ownership-seed.json','ownership-data.json'),('cb-chip-seed.json','cb-chip-data.json'),('regulatory-seed.json','regulatory-data.json'),('revenue-seed.json','revenue-data.json'),('convertible-seed.json','convertible-data.json'),('futchip-radar.js','futchip-radar.js'),('margin-maintenance.js','margin-maintenance.js'),('fear-greed.js','fear-greed.js'),('taiwan-sentiment-model.js','taiwan-sentiment-model.js'),('tw-fear-greed.js','tw-fear-greed.js'),('taiwan-sentiment-seed.json','taiwan-sentiment-data.json'),('fear-greed-seed.json','fear-greed-data.json'),('margin-maintenance-seed.json','margin-maintenance-data.json'),('world-radar.js','world-radar.js'),('chipburst-radar.js','chipburst-radar.js'),('broker-seed.json','broker-data.json'),('futchip-seed.json','futchip-data.json'),('index.html','index.html'),('app.js','app.js'),('relative-strength.js','relative-strength.js'),('revenue-radar.js','revenue-radar.js'),('convertible-radar.js','convertible-radar.js'),('sector-capital.js','sector-capital.js'),('exhibition-radar.js','exhibition-radar.js'),('warrant-radar.js','warrant-radar.js'),('warrant-seed.json','warrant-data.json'),('higher-low-radar.js','higher-low-radar.js'),('market-overview.js','market-overview.js'),('market-overview-seed.json','market-overview-data.json'),('pattern-backtest.js','pattern-backtest.js'),('launch-model.js','launch-model.js'),('overnight-radar.js','overnight-radar.js'),('overnight-seed.json','overnight-data.json'),('style.css','style.css'),('structure-patterns.js','structure-patterns.js'),('rule-diagrams.js','rule-diagrams.js'),('detail-chart.js','detail-chart.js'),('detail-collapse.js','detail-collapse.js'),('smc-zones.js','smc-zones.js'),('etf-radar.js','etf-radar.js'),('etf-seed.json','etf-data.json'),('prison-seed.json','prison-data.json'),('prison.js','prison.js')]:
        shutil.copy2(saved_root/source,saved_public/target)
    (saved_public/'market-data.json').unlink(missing_ok=True)
    market_path=saved_public/'market-data.json.gz'
    market=merge_verified_history(json.loads(gzip.decompress(market_path.read_bytes())),saved_root)
    market_path.write_bytes(gzip.compress(json.dumps(market,ensure_ascii=False,separators=(',',':')).encode('utf-8'),mtime=0))
    print('Protected site built from saved official snapshots.')
    sys.exit(0)
import market_data as m
root=Path(__file__).resolve().parent
m.PUBLIC.mkdir(exist_ok=True)
if (root/'valuation-seed.json').exists():shutil.copy2(root/'valuation-seed.json',m.PUBLIC/'valuation-data.json')
seed=gzip.decompress((root/'seed.json.gz').read_bytes())
site=os.environ.get('SITE_URL','').rstrip('/')
if site and '--offline' not in sys.argv:
    try:
        with urllib.request.urlopen(site+'/market-data.json.gz',timeout=45) as response:
            prior=json.loads(gzip.decompress(response.read()))
        if not isinstance(prior.get('stocks'),list) or len(prior['stocks'])<50:raise ValueError('Invalid previous snapshot')
        if prior.get('updated_at','')>json.loads(seed).get('updated_at',''):seed=json.dumps(prior,ensure_ascii=False).encode()
    except urllib.error.HTTPError as e:
        if e.code!=404:raise
m.SNAPSHOT.write_bytes(seed)
if '--offline' not in sys.argv:m.update()
import institutional_data
institutional_data.update(root,m.PUBLIC,'--offline' in sys.argv)
import ownership_data
ownership_data.update(root,m.PUBLIC,site,'--offline' in sys.argv)
import revenue_data
try: revenue_data.update(root,m.PUBLIC)
except Exception as e:
    print('Revenue update failed; preserving previous snapshot:',e)
    if (root/'revenue-seed.json').exists():shutil.copy2(root/'revenue-seed.json',m.PUBLIC/'revenue-data.json')
import convertible_data
try: convertible_data.update(root,m.PUBLIC)
except Exception as e:
    print('Convertible update failed; preserving previous snapshot:',e)
    if (root/'convertible-seed.json').exists():shutil.copy2(root/'convertible-seed.json',m.PUBLIC/'convertible-data.json')
data=m.read_snapshot();data.pop('history_backfill',None)
import regulatory_data
try: regulatory_data.update(root,m.PUBLIC,max(b['date'] for s in data['stocks'] for b in s['bars']))
except Exception as e:
    print('Regulatory update failed; preserving previous snapshot:',e)
    if (root/'regulatory-seed.json').exists():shutil.copy2(root/'regulatory-seed.json',m.PUBLIC/'regulatory-data.json')
import prison_data
try: prison_data.update(root,m.PUBLIC)
except Exception as e:
    print("Disposal update failed; preserving previous snapshot:",e)
    if (root/"prison-seed.json").exists():shutil.copy2(root/"prison-seed.json",m.PUBLIC/"prison-data.json")
import etf_data
try: etf_data.update(root,m.PUBLIC)
except Exception as e:
    print('ETF update failed; preserving previous snapshot:',e)
    if (root/'etf-seed.json').exists():shutil.copy2(root/'etf-seed.json',m.PUBLIC/'etf-data.json')
shutil.copy2(root/'futchip-seed.json',m.PUBLIC/'futchip-data.json')
shutil.copy2(root/'margin-maintenance.js',m.PUBLIC/'margin-maintenance.js')
shutil.copy2(root/'fear-greed.js',m.PUBLIC/'fear-greed.js')
shutil.copy2(root/'taiwan-sentiment-model.js',m.PUBLIC/'taiwan-sentiment-model.js')
shutil.copy2(root/'tw-fear-greed.js',m.PUBLIC/'tw-fear-greed.js')
shutil.copy2(root/'fear-greed-seed.json',m.PUBLIC/'fear-greed-data.json')
shutil.copy2(root/'margin-maintenance-seed.json',m.PUBLIC/'margin-maintenance-data.json')
for name in ['launch-model.js','pattern-backtest.js','futchip-radar.js','world-radar.js','chipburst-radar.js','index.html','style.css','app.js','relative-strength.js','revenue-radar.js','convertible-radar.js','sector-capital.js','exhibition-radar.js','warrant-radar.js','higher-low-radar.js','overnight-radar.js','structure-patterns.js','detail-chart.js','detail-collapse.js','smc-zones.js','etf-radar.js','rule-diagrams.js','prison.js']:shutil.copy2(root/name,m.PUBLIC/name)
data=merge_verified_history(data,root)
with gzip.GzipFile(filename=str(m.PUBLIC/'market-data.json.gz'),mode='wb',mtime=0) as f:
    f.write(json.dumps(data,ensure_ascii=False,separators=(',',':')).encode())
import broker_data
try: broker_data.update(root,m.PUBLIC,1)
except Exception as e:
    print('Branch update failed; preserving previous snapshot:',e)
    if (root/'broker-seed.json').exists():shutil.copy2(root/'broker-seed.json',m.PUBLIC/'broker-data.json')
import taiwan_sentiment_data
try: taiwan_sentiment_data.update(root,m.PUBLIC)
except Exception as e:
    print('Taiwan sentiment update failed; preserving snapshot:',e)
    if (root/'taiwan-sentiment-seed.json').exists():shutil.copy2(root/'taiwan-sentiment-seed.json',m.PUBLIC/'taiwan-sentiment-data.json')
import cb_chip_data
cb_chip_data.update(root,m.PUBLIC)
m.SNAPSHOT.unlink()
(m.PUBLIC/'.nojekyll').touch()
print(json.dumps({'stocks':len(data['stocks']),'updated_at':data['updated_at'],'public_files':[p.name for p in m.PUBLIC.iterdir()]}))





if (root/'overnight-seed.json').exists():shutil.copy2(root/'overnight-seed.json',m.PUBLIC/'overnight-data.json')

if (root/'warrant-seed.json').exists():shutil.copy2(root/'warrant-seed.json',m.PUBLIC/'warrant-data.json')

if (root/'market-overview-seed.json').exists():shutil.copy2(root/'market-overview-seed.json',m.PUBLIC/'market-overview-data.json')

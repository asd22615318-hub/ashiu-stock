"""Build the Pages artifact from public quotes only. Requires Windows Python."""
import gzip,json,os,shutil,sys,urllib.request,urllib.error
from pathlib import Path
if '--offline' in sys.argv:
    # The Cloudflare Linux builder deploys saved snapshots; the Windows job fetches reports.
    saved_root=Path(__file__).resolve().parent
    saved_public=saved_root/'dist'
    saved_public.mkdir(exist_ok=True)
    for source,target in [('seed.json.gz','market-data.json.gz'),('institutional-seed.json','institutional-data.json'),('ownership-seed.json','ownership-data.json'),('regulatory-seed.json','regulatory-data.json'),('index.html','index.html'),('app.js','app.js'),('style.css','style.css'),('structure-patterns.js','structure-patterns.js'),('detail-chart.js','detail-chart.js'),('etf-radar.js','etf-radar.js'),('rule-diagrams.js','rule-diagrams.js'),('etf-seed.json','etf-data.json'),('prison-seed.json','prison-data.json'),('prison.js','prison.js')]:
        shutil.copy2(saved_root/source,saved_public/target)
    (saved_public/'market-data.json').unlink(missing_ok=True)
    print('Protected site built from saved official snapshots.')
    sys.exit(0)
import market_data as m
root=Path(__file__).resolve().parent
m.PUBLIC.mkdir(exist_ok=True)
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
data=m.read_snapshot();data.pop('history_backfill',None)
import regulatory_data
regulatory_data.update(root,m.PUBLIC,max(b['date'] for s in data['stocks'] for b in s['bars']))
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
for name in ['index.html','style.css','app.js','structure-patterns.js','detail-chart.js','etf-radar.js','rule-diagrams.js','prison.js']:shutil.copy2(root/name,m.PUBLIC/name)
with gzip.GzipFile(filename=str(m.PUBLIC/'market-data.json.gz'),mode='wb',mtime=0) as f:
    f.write(json.dumps(data,ensure_ascii=False,separators=(',',':')).encode())
m.SNAPSHOT.unlink()
(m.PUBLIC/'.nojekyll').touch()
print(json.dumps({'stocks':len(data['stocks']),'updated_at':data['updated_at'],'public_files':[p.name for p in m.PUBLIC.iterdir()]}))

"""Build the Pages artifact from public quotes only. Requires Windows Python."""
import gzip,json,os,shutil,sys,urllib.request,urllib.error
from pathlib import Path
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
for name in ['index.html','style.css','app.js']:shutil.copy2(root/name,m.PUBLIC/name)
with gzip.GzipFile(filename=str(m.PUBLIC/'market-data.json.gz'),mode='wb',mtime=0) as f:
    f.write(json.dumps(data,ensure_ascii=False,separators=(',',':')).encode())
m.SNAPSHOT.unlink()
(m.PUBLIC/'.nojekyll').touch()
print(json.dumps({'stocks':len(data['stocks']),'updated_at':data['updated_at'],'public_files':[p.name for p in m.PUBLIC.iterdir()]}))

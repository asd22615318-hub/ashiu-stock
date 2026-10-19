"""CI-only publication with a fresh branch base and quote-date regression guards."""
import gzip
import json
import os
from pathlib import Path
import subprocess
import sys


def market_dates(content):
    data=json.loads(gzip.decompress(content))
    result={}
    for stock in data.get('stocks',[]):
        if stock.get('bars'):
            market=stock.get('market','')
            result[market]=max(result.get(market,''),stock['bars'][-1]['date'])
    return result


def can_replace(name,current,candidate):
    if name=='seed.json.gz':
        old,new=market_dates(current),market_dates(candidate)
        return all(new.get(market,'')>=day for market,day in old.items())
    if name=='taiwan-sentiment-seed.json':
        latest=lambda content:max((row.get('d','') for row in json.loads(content).get('rows',[])),default='')
        return latest(candidate)>=latest(current)
    return True


def publish(names):
    if os.environ.get('GITHUB_ACTIONS')!='true':
        raise RuntimeError('This publisher runs only in GitHub Actions.')
    root=Path(__file__).resolve().parent
    saved={name:(root/name).read_bytes() for name in names}
    def git(*args,check=True):
        return subprocess.run(['git',*args],cwd=root,check=check)
    git('config','user.name','github-actions[bot]')
    git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
    for _ in range(3):
        git('fetch','origin','main')
        git('reset','--hard','origin/main')
        for name,content in saved.items():
            path=root/name
            if path.exists() and not can_replace(name,path.read_bytes(),content):
                print('Preserving newer snapshot:',name,flush=True)
                continue
            path.write_bytes(content)
        git('add','--',*names)
        diff=git('diff','--cached','--quiet',check=False).returncode
        if diff==0:return
        if diff!=1:raise RuntimeError('Unable to inspect snapshot changes')
        git('commit','-m','Update official market snapshots')
        if git('push','origin','HEAD:main',check=False).returncode==0:return
    raise RuntimeError('Could not publish snapshots after three attempts')


if __name__=='__main__':publish(sys.argv[1:])

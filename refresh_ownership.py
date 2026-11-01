"""Refresh TDCC weekly holdings independently of other market reports."""
import shutil
from pathlib import Path
import ownership_data

def main():
    root=Path(__file__).resolve().parent
    public=root/'dist'
    public.mkdir(exist_ok=True)
    ownership_data.update(root,public)
    shutil.copy2(public/'ownership-data.json',root/'ownership-seed.json')

if __name__=='__main__':
    main()

#!/usr/bin/env python3
"""Cache photographs for the first 40 temples; preserve remote source and license metadata."""
import concurrent.futures, json, subprocess
from pathlib import Path
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'src/data/temples.json'
records=json.loads(path.read_text())
folder=ROOT/'public/temple-images'
folder.mkdir(exist_ok=True)

def cache(record):
    image=record.get('image')
    if not image: return False
    url=image['url']
    suffix=Path(urlparse(url).path).suffix.lower()
    if suffix not in ['.jpg','.jpeg','.png','.webp','.gif']: return False
    target=folder/(record['qid'].replace(' ','-')+suffix)
    if not target.exists() or image.get('localPath') != '/temple-images/'+target.name:
        temp=target.with_suffix(target.suffix+'.tmp')
        r=subprocess.run(['curl','--fail','--silent','--show-error','--location','--max-time','45',url,'-o',str(temp)],capture_output=True)
        if r.returncode or not temp.exists() or temp.stat().st_size<500:
            temp.unlink(missing_ok=True)
            return False
        header=temp.read_bytes()[:12]
        if not (header.startswith(b'\xff\xd8') or header.startswith(b'\x89PNG') or header.startswith(b'GIF8') or (header[:4]==b'RIFF' and header[8:12]==b'WEBP')):
            temp.unlink(missing_ok=True)
            return False
        temp.replace(target)
    image['localPath']='/temple-images/'+target.name
    return True

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    success=sum(pool.map(cache,records[:40]))
path.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
(ROOT/'src/data/featured-temples.json').write_text(json.dumps(records[:20],ensure_ascii=False,indent=2)+'\n')
print(f'Cached {success} temple photographs locally.')

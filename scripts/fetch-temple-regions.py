#!/usr/bin/env python3
"""Small, sequential recovery extracts for temple-dense regions; no paid APIs."""
import json,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'.temple-cache/osm'
regions=[('tamil-nadu',(8,76,13.7,80.5)),('bali',(-8.9,114.4,-8,115.8)),('nepal',(26.3,80,30.5,88.3)),('mauritius',(-20.6,57.2,-19.9,57.9))]
report=[]
for name,bbox in regions:
 path=CACHE/f'region-{name}.json'
 if not path.exists():
  box=','.join(map(str,bbox));query=f'[out:json][timeout:45];nwr["amenity"="place_of_worship"]["religion"="hindu"]({box});out center tags;'
  result=subprocess.run(['curl','-fsS','--max-time','60','-A','MandirGlobe/1.0 (public temple atlas recovery)','--get','--data-urlencode','data='+query,'https://overpass.private.coffee/api/interpreter'],capture_output=True)
  try:
   data=json.loads(result.stdout)
   if result.returncode or data.get('remark') or 'elements' not in data:raise ValueError('Incomplete response')
   path.write_text(json.dumps(data))
  except (ValueError,OSError):
   report.append({'region':name,'status':'deferred','error':result.stderr.decode()[:200] or 'Incomplete response'});print(f'{name}: deferred',flush=True)
   time.sleep(30 if b'429' in result.stderr or b'406' in result.stderr else 3);continue
 data=json.loads(path.read_text());report.append({'region':name,'features':len(data['elements']),'status':'downloaded'});print(f'{name}: {len(data["elements"]):,} features',flush=True);time.sleep(3)
(ROOT/'src/data/osm-region-recovery-report.json').write_text(json.dumps(report,indent=2)+'\n')

#!/usr/bin/env python3
"""One-time, sequential regional extract from the You.com-discovered OSM source."""
import json, subprocess, time, argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.temple-cache/osm';CACHE.mkdir(exist_ok=True)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--retry-failed",action="store_true")
parser.add_argument("--endpoint",default="https://overpass-api.de/api/interpreter")
args=parser.parse_args()
report=ROOT/"src/data/osm-import-report.json"
bands=[(x,x+30) for x in range(-180,180,30)]
if args.retry_failed:
 previous=json.loads(report.read_text())
 bands=[(r["west"],r["east"]) for r in previous.get("failedRegions",[])]
failures=[];total=0
# Longitude bands bound server work and make this resumable without repeating downloads.
for west,east in bands:
 path=CACHE/f'{west}_{east}.json'
 if not path.exists():
  query=f'[out:json][timeout:90];nwr["amenity"="place_of_worship"]["religion"="hindu"](-90,{west},90,{east});out center tags;'
  temp=path.with_suffix('.tmp')
  result=subprocess.run(['curl','--fail','--silent','--show-error','--max-time','120','-A','MandirGlobe/1.0 (one-time public temple data import)','--get','--data-urlencode','data='+query,args.endpoint,'-o',str(temp)],capture_output=True)
  try:
   data=json.loads(temp.read_text())
   if result.returncode or 'remark' in data or 'elements' not in data:raise ValueError('Incomplete response')
   temp.replace(path)
  except (ValueError,OSError):
   failures.append({'west':west,'east':east,'error':result.stderr.decode()[:150] or 'Incomplete Overpass response'});print(f'OSM band {west} to {east}: deferred (incomplete or failed response)',flush=True);temp.unlink(missing_ok=True);time.sleep(30 if b'429' in result.stderr or b'406' in result.stderr else 5);continue
 data=json.loads(path.read_text());total+=len(data['elements'])
 print(f'OSM band {west} to {east}: {len(data["elements"]):,} Hindu worship features; running total {total:,}',flush=True)
 time.sleep(3)
cached_bands=[]
for west in range(-180,180,30):
 path=CACHE/f'{west}_{west+30}.json'
 if path.exists():
  d=json.loads(path.read_text())
  if 'elements' in d and not d.get('remark'):cached_bands.append({'west':west,'east':west+30,'features':len(d['elements'])})
report.write_text(json.dumps({'successfulRegions':cached_bands,'source':'https://www.openstreetmap.org/copyright','discoveredVia':'You.com','classification':'amenity=place_of_worship and religion=hindu','rawFeatures':sum(r['features'] for r in cached_bands),'failedRegions':failures,'completeGlobalInventory':False},indent=2)+'\n')
print(f'OSM fetch complete: {total:,} raw features; {len(failures)} failed longitude bands',flush=True)

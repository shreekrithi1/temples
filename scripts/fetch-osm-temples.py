#!/usr/bin/env python3
"""One-time, sequential regional extract from the You.com-discovered OSM source."""
import json, subprocess, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.temple-cache/osm';CACHE.mkdir(exist_ok=True)
failures=[];total=0
# Longitude bands bound server work and make this resumable without repeating downloads.
for west,east in [(x,x+30) for x in range(-180,180,30)]:
 path=CACHE/f'{west}_{east}.json'
 if not path.exists():
  query=f'[out:json][timeout:90];nwr["amenity"="place_of_worship"]["religion"="hindu"](-90,{west},90,{east});out center tags;'
  temp=path.with_suffix('.tmp')
  result=subprocess.run(['curl','--fail','--silent','--show-error','--max-time','120','-A','MandirGlobe/1.0 (one-time public temple data import)','--get','--data-urlencode','data='+query,'https://overpass-api.de/api/interpreter','-o',str(temp)],capture_output=True)
  try:
   data=json.loads(temp.read_text())
   if result.returncode or 'remark' in data or 'elements' not in data:raise ValueError('Incomplete response')
   temp.replace(path)
  except (ValueError,OSError):
   failures.append({'west':west,'east':east,'error':result.stderr.decode()[:150]});temp.unlink(missing_ok=True);time.sleep(5);continue
 data=json.loads(path.read_text());total+=len(data['elements'])
 print(f'OSM band {west} to {east}: {len(data["elements"]):,} Hindu worship features; running total {total:,}',flush=True)
 time.sleep(1)
(ROOT/'src/data/osm-import-report.json').write_text(json.dumps({'source':'https://www.openstreetmap.org/copyright','discoveredVia':'You.com','classification':'amenity=place_of_worship and religion=hindu','rawFeatures':total,'failedRegions':failures,'completeGlobalInventory':False},indent=2)+'\n')
print(f'OSM fetch complete: {total:,} raw features; {len(failures)} failed longitude bands',flush=True)

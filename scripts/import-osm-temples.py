#!/usr/bin/env python3
"""Merge the cached, explicitly Hindu OSM worship features with source attribution."""
import json, math, re, unicodedata
from pathlib import Path
from datetime import date
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1];DEST=ROOT/'src/data'
files=list((ROOT/'.temple-cache/osm').glob('*.json'))
if not files:raise SystemExit('No successful OSM extracts; existing catalog unchanged.')
catalog=json.loads((DEST/'temples.json').read_text());before=len(catalog)
identities={t['qid']:t for t in catalog}
for t in catalog:
 if t.get('wikidataId'):identities[t['wikidataId']]=t
countries={}
for line in (ROOT/'.temple-cache/geonames/countryInfo.txt').read_text().splitlines():
 if line and not line.startswith('#'):
  c=line.split('\t');countries[c[0]]=c[4]
polygons=[]
for feature in json.loads((ROOT/'public/countries.geojson').read_text())['features']:
 g=feature['geometry'];parts=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
 name=feature['properties']['ADMIN'].replace('United States of America','United States')
 for rings in parts:
  ring=rings[0];xs=[p[0] for p in ring];ys=[p[1] for p in ring]
  polygons.append((min(xs),min(ys),max(xs),max(ys),name,rings))
def inside(x,y,ring):
 result=False;j=len(ring)-1
 for i,(xi,yi) in enumerate(ring):
  xj,yj=ring[j]
  if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi)+xi:result=not result
  j=i
 return result

def country_at(lon,lat):
 for x1,y1,x2,y2,name,rings in polygons:
  if x1<=lon<=x2 and y1<=lat<=y2 and inside(lon,lat,rings[0]) and not any(inside(lon,lat,r) for r in rings[1:]):return name
 return ''
def normalize(name):return re.sub(r'[^\w]','',unicodedata.normalize('NFKC',name).casefold())
grid=defaultdict(list)
def cell(lat,lon):return math.floor(lat*1000),math.floor(lon*1000)
for t in catalog:grid[cell(t['lat'],t['lon'])].append(t)
rawseen=set();duplicates=0;unnamed=0;new=[];partial=[]
for path in files:
 response=json.loads(path.read_text())
 if response.get('remark'):partial.append({'file':path.name,'remark':response['remark']})
 for e in response['elements']:
  identity=f'osm-{e["type"]}-{e["id"]}'
  if identity in rawseen:continue
  rawseen.add(identity)
  tags=e.get('tags',{});coord=e if e['type']=='node' else e.get('center',{})
  if tags.get('amenity')!='place_of_worship' or tags.get('religion')!='hindu':continue
  lat=coord.get('lat');lon=coord.get('lon')
  if not isinstance(lat,(float,int)) or not isinstance(lon,(float,int)) or not -90<=lat<=90 or not -180<=lon<=180:continue
  qid=tags.get('wikidata','');source=f'https://www.openstreetmap.org/{e["type"]}/{e["id"]}'
  name=tags.get('name:en') or tags.get('name')
  match=identities.get(identity) or identities.get(qid)
  x,y=cell(lat,lon)
  if not match and name:
   for dx in [-1,0,1]:
    for dy in [-1,0,1]:
     for t in grid[(x+dx,y+dy)]:
      distance=math.hypot((t['lat']-lat)*111000,(t['lon']-lon)*111000*math.cos(math.radians(lat)))
      if distance<40 and normalize(t['name'])==normalize(name):match=t;break
  if match:
   if source!=match.get('sourceUrl'):
    match['additionalSourceUrls']=list(dict.fromkeys(match.get('additionalSourceUrls',[])+[source]))
   duplicates+=1;continue
  if not name:unnamed+=1
  country=countries.get(tags.get('addr:country','').upper()) or country_at(lon,lat)
  location=', '.join(dict.fromkeys(v for v in [tags.get('addr:city') or tags.get('addr:village'),tags.get('addr:state'),country] if v))
  record={'qid':identity,'name':name or 'Unnamed Hindu place of worship','nameRecorded':bool(name),'lat':lat,'lon':lon,'country':country,'location':location,'countrySource':'OpenStreetMap address' if tags.get('addr:country') in countries else 'Natural Earth boundary lookup' if country else 'Not recorded','deity':'Not recorded','description':'Recorded by OpenStreetMap contributors as a Hindu place of worship. A detailed history is not available in this source.','sourceUrl':source,'descriptionSourceUrl':source,'descriptionSourceName':'OpenStreetMap contributors','descriptionLicense':'ODbL 1.0','dataLicenseUrl':'https://www.openstreetmap.org/copyright','image':None,'updatedAt':str(date.today()),'discoveredVia':'You.com / OpenStreetMap','coordinateSource':'OSM node' if e['type']=='node' else 'OSM feature bounding-box center'}
  deity=tags.get('deity','').strip()
  groups={'shiva':'Shiva','vishnu':'Vishnu','krishna':'Vishnu','rama':'Vishnu','ganesha':'Ganesha','ganesh':'Ganesha','murugan':'Murugan','durga':'Devi','kali':'Devi','hanuman':'Hanuman','swaminarayan':'Swaminarayan','ayyappan':'Ayyappan','surya':'Surya'}
  if deity:record['presidingDeity']=deity;record['deity']=groups.get(deity.lower(),'Other')
  if re.fullmatch('Q[0-9]+',qid):record['wikidataId']=qid
  website=tags.get('website') or tags.get('contact:website')
  if website and website.startswith(('https://','http://')):record['websiteUrl']=website
  record['osmTags']={k:v for k,v in tags.items() if k in ['name','name:en','religion','amenity','denomination','deity','building','historic','heritage','addr:city','addr:village','addr:state','addr:country','wikipedia','wikidata','start_date']}
  grid[(x,y)].append(record);identities[identity]=record
  if qid:identities[qid]=record
  new.append(record)
new.sort(key=lambda t:(not t['nameRecorded'],t['country'],t['name']))
catalog.extend(new)
meta=json.loads((DEST/'catalog-meta.json').read_text())
meta.update({'updatedAt':str(date.today()),'count':len(catalog),'countries':len({t['country'] for t in catalog if t.get('country')}),'withImages':sum(bool(t.get('image')) for t in catalog),'osmImport':{'rawFeatures':len(rawseen),'added':len(new),'duplicatesMatched':duplicates,'unnamedFeatures':unnamed,'license':'ODbL 1.0','attribution':'© OpenStreetMap contributors','source':'https://www.openstreetmap.org/copyright','completeGlobalInventory':False,'partialExtracts':partial}})
clause='; explicitly Hindu OpenStreetMap places of worship (including shrines and unnamed sites)'
if clause not in meta['classification']:meta['classification']+=clause
temporary=DEST/'temples.json.tmp';temporary.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n');temporary.replace(DEST/'temples.json')
(DEST/'catalog-meta.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps({'before':before,'added':len(new),'total':len(catalog),'countries':meta['countries'],'unnamed':unnamed,'duplicatesMatched':duplicates}),flush=True)

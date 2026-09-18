#!/usr/bin/env python3
"""Create a bounded, geographically distributed You.com search queue from GeoNames."""
import json, zipfile
from pathlib import Path
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1]
base=ROOT/'.temple-cache/geonames'
countries={}
for line in (base/'countryInfo.txt').read_text().splitlines():
 if not line or line.startswith('#'):continue
 c=line.split('\t');countries[c[0]]={'name':c[4],'continent':c[8]}
admins={}
for line in (base/'admin1CodesASCII.txt').read_text().splitlines():
 c=line.split('\t');admins[c[0]]=c[1]
places=[]
with zipfile.ZipFile(base/'cities500.zip') as z:
 for line in z.read('cities500.txt').decode().splitlines():
  c=line.split('\t')
  if c[8] not in countries or c[6]!='P':continue
  places.append({'geonamesId':c[0],'name':c[1],'asciiName':c[2],'countryCode':c[8],'country':countries[c[8]]['name'],'continent':countries[c[8]]['continent'],'region':admins.get(c[8]+'.'+c[10],''),'population':int(c[14] or 0)})
queries=[]
for name in ['Africa','Asia','Europe','North America','South America','Oceania','Antarctica']:
 queries.append({'level':'continent','place':name,'query':f'Hindu temples mandir in {name} directory list locations'})
queries.append({'level':'bulk-source','place':'Worldwide','query':'OpenStreetMap Hindu temples worldwide bulk dataset Overpass religion hindu'})
for code,country in sorted(countries.items()):
 queries.append({'level':'country','place':country['name'],'countryCode':code,'continent':country['continent'],'query':f'Hindu temples mandir in {country["name"]} directory list locations'})
selected=[];seen=set()
def add(p):
 if p['geonamesId'] not in seen:seen.add(p['geonamesId']);selected.append(p)
india=sorted([p for p in places if p['countryCode']=='IN'],key=lambda p:(-p['population'],p['geonamesId']))
for p in india[:1400]:add(p)
small=defaultdict(list)
for p in india:
 if p['population']<10000:small[p['region']].append(p)
for i in range(max(map(len,small.values()))):
 for group in sorted(small):
  if len(selected)>=2000:break
  if i<len(small[group]):add(small[group][i])
 if len(selected)>=2000:break
for p in india:
 if len(selected)>=2000:break
 add(p)
others=defaultdict(list)
for p in sorted(places,key=lambda p:(-p['population'],p['geonamesId'])):
 if p['countryCode']!='IN':others[p['countryCode']].append(p)
for i in range(max(map(len,others.values()))):
 for country in sorted(others,key=lambda c:(countries[c]['continent'],c)):
  if len(queries)+len(selected)>=4000:break
  if i<len(others[country]):add(others[country][i])
 if len(queries)+len(selected)>=4000:break
# Complete broad international coverage before the extra India-focused searches.
selected.sort(key=lambda p:(p['countryCode']=='IN',-p['population']))
for p in selected:
 location=', '.join(dict.fromkeys(x for x in [p['name'],p['region'],p['country']] if x))
 queries.append({'level':'settlement','place':location,**p,'query':f'Hindu temples mandir kovil in {location} names locations'})
plan={'source':'https://download.geonames.org/export/dump/','license':'CC BY 4.0','sourceSettlementCount':len(places),'completeGlobalInventory':False,'budgetUSD':20,'maxAttemptedCalls':4000,'pricePerCallUSD':0.005,'pricingSource':'https://you.com/docs/administration/billing','queries':queries}
(ROOT/'src/data/you-settlement-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'queries':len(queries),'sourceSettlements':len(places),'indiaSettlements':sum(p['countryCode']=='IN' for p in selected),'internationalSettlements':sum(p['countryCode']!='IN' for p in selected),'countries':len(countries)}))

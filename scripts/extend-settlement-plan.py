#!/usr/bin/env python3
"""Append previously unsearched settlements to the queue; never modifies spending authorization."""
import json,zipfile,argparse
from pathlib import Path
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'src/data';BASE=ROOT/'.temple-cache/geonames'
parser=argparse.ArgumentParser();parser.add_argument('--additional',type=int,default=2000);args=parser.parse_args()
plan=json.loads((DATA/'you-settlement-plan.json').read_text());seen={str(q.get('geonamesId')) for q in plan['queries']};countries={};admins={}
for line in (BASE/'countryInfo.txt').read_text().splitlines():
 if line and not line.startswith('#'):
  c=line.split('\t');countries[c[0]]={'name':c[4],'continent':c[8]}
for line in (BASE/'admin1CodesASCII.txt').read_text().splitlines():
 c=line.split('\t');admins[c[0]]=c[1]
groups=defaultdict(list)
with zipfile.ZipFile(BASE/'cities500.zip') as archive:
 for line in archive.read('cities500.txt').decode().splitlines():
  c=line.split('\t')
  if c[0] in seen or c[8] not in countries or c[6]!='P':continue
  p={'geonamesId':c[0],'name':c[1],'asciiName':c[2],'countryCode':c[8],'country':countries[c[8]]['name'],'continent':countries[c[8]]['continent'],'region':admins.get(c[8]+'.'+c[10],''),'population':int(c[14] or 0)}
  groups[c[8]].append(p)
for places in groups.values():places.sort(key=lambda p:-p['population'])
chosen=groups['IN'][:args.additional//2]
priority=['NP','LK','ID','BD','MY','MU','FJ','GY','SR','TT','SG','TH','KH','GB','US','CA','AU','NZ','ZA','KE','UG','TZ','AE','OM','DE','FR','NL','CH','IT','ES','PT','BR','AR','CL','MX','JP','KR']
for i in range(max(len(groups[c]) for c in priority)):
 for code in priority:
  if len(chosen)>=args.additional:break
  if i<len(groups[code]):chosen.append(groups[code][i])
 if len(chosen)>=args.additional:break
seen_queries={q['query'] for q in plan['queries']}
added=0
for p in chosen:
 location=', '.join(dict.fromkeys(x for x in [p['name'],p['region'],p['country']] if x))
 query=f'Hindu temples mandir kovil in {location} names locations'
 if query in seen_queries:continue
 seen_queries.add(query);added+=1
 plan['queries'].append({'level':'settlement','place':location,**p,'query':f'Hindu temples mandir kovil in {location} names locations'})
plan['budgetUSD']=30;plan['maxAttemptedCalls']=6000
(DATA/'you-settlement-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'addedQueries':added,'totalQueries':len(plan['queries']),'newCountries':len({p['countryCode'] for p in chosen})}))

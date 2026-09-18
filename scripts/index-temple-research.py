#!/usr/bin/env python3
"""Index temple-related search pages without treating them as verified places."""
import json,re,hashlib
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit,parse_qsl,urlencode
from collections import Counter
ROOT=Path(__file__).resolve().parents[1];DEST=ROOT/'src/data'
def search_rows():
 archive=DEST/'you-settlement-research.json'
 if not archive.exists():
  for path in (ROOT/'.temple-cache/you-settlements').glob('*.json'):yield json.loads(path.read_text())
  return
 # Stream one query object at a time rather than loading the entire archive.
 decoder=json.JSONDecoder()
 with archive.open() as stream:
  buffer=''
  while True:
   chunk=stream.read(65536)
   if not chunk:raise ValueError('Missing searches array')
   buffer+=chunk;match=re.search(r'"searches"\s*:\s*\[',buffer)
   if match:buffer=buffer[match.end():];break
  while True:
   buffer=buffer.lstrip(' \r\n\t,')
   if buffer.startswith(']'):return
   try:row,end=decoder.raw_decode(buffer)
   except json.JSONDecodeError:
    chunk=stream.read(65536)
    if not chunk:raise ValueError('Truncated research archive')
    buffer+=chunk;continue
   yield row;buffer=buffer[end:]
index={};regions=Counter();levels=Counter();total=0;queries=0;unique_queries=set()
for row in search_rows():
 queries+=1;unique_queries.add(row['query']);levels[row['level']]+=1
 if row.get('countryCode'):regions[row['countryCode']]+=1
 for result in row['results']:
  total+=1
  title=result.get('title','')
  if not re.search(r'\btemple\b|mandir|kovil|devasthan|devalaya|kuil|pura ',title,re.I):continue
  if re.search(r'\b(?:hotel|restaurant|apartment|synagogue|mormon|buddhist|jain|sikh)\b',title,re.I):continue
  try:
   u=urlsplit(result['url'])
   if u.scheme not in ['http','https']:continue
   query=urlencode([(k,v) for k,v in parse_qsl(u.query) if not k.startswith('utm_') and k not in ['fbclid','gclid']])
   url=urlunsplit((u.scheme,u.netloc.lower(),u.path.rstrip('/'),query,''))
  except ValueError:continue
  if url not in index:
   index[url]={'id':'research-'+hashlib.sha256(url.encode()).hexdigest()[:16],'pageTitle':title,'sourceUrl':url,'searchDescription':result.get('description',''),'verificationStatus':'unverified source page; may describe multiple temples or duplicate another page','discoveredVia':'You.com','searchedAt':row.get('searchedAt'),'searchContexts':[]}
  context={'level':row['level'],'place':row['place']}
  if context not in index[url]['searchContexts'] and len(index[url]['searchContexts'])<10:index[url]['searchContexts'].append(context)
(DEST/'temple-research-candidates.json').write_text(json.dumps({'note':'These are deduplicated source pages, NOT a count of temples. Search context does not verify a temple location. No coordinates are inferred from the queried settlement.','candidatePages':list(index.values())},ensure_ascii=False,indent=2)+'\n')
catalog=json.loads((DEST/'temples.json').read_text());budget=json.loads((DEST/'you-settlement-budget.json').read_text())
summary={'completeGlobalInventory':False,'completedSearchEntries':queries,'uniqueSuccessfulQueries':len(unique_queries),'searchResults':total,'templeRelatedSourcePages':len(index),'queryLevels':dict(levels),'countryTerritorySearchCoverage':len(regions),'searchesByCountryCode':dict(regions),'verifiedCatalogRecords':len(catalog),'youDiscoveredVerifiedRecords':sum(t.get('discoveredVia')=='You.com' for t in catalog),'catalogCountries':len({t.get('country') for t in catalog if t.get('country')}),'catalogPhotos':sum(bool(t.get('image')) for t in catalog),'budget':budget,'limitations':['Search results and candidate pages are not verified temple records.','The place index and budget do not cover every village.','Public Wikimedia sources returned rate limits; unresolved requests are recorded separately.','Bulk OpenStreetMap endpoints were unavailable; no records were imported from that source.']}
(DEST/'worldwide-collection-report.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['searchesByCountryCode','budget','limitations']}))

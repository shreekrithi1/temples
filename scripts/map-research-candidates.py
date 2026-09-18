#!/usr/bin/env python3
"""Map saved You.com candidates with primary Wikipedia coordinates; no paid calls."""
import json, hashlib, subprocess, time, re, html
from pathlib import Path
from urllib.parse import urlencode, unquote
from datetime import date
ROOT=Path(__file__).resolve().parents[1];DEST=ROOT/'src/data';CACHE=ROOT/'.temple-cache/coordinates';CACHE.mkdir(exist_ok=True)
failures=[];blocked=set()
def api(host,params):
 url=f'https://{host}/w/api.php?'+urlencode({'format':'json','formatversion':2,**params})
 path=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.json')
 if path.exists():return json.loads(path.read_text())
 if host in blocked:return {}
 r=subprocess.run(['curl','--silent','--show-error','--fail','--max-time','30','-A','MandirGlobe/1.0 (public temple atlas)',url],capture_output=True)
 if r.returncode:
  failures.append({'url':url,'error':r.stderr.decode()[:200]})
  if b'429' in r.stderr:blocked.add(host)
  return {}
 try:
  data=json.loads(r.stdout)
  if 'error' in data:raise ValueError('API error')
  path.write_text(json.dumps(data));time.sleep(1);return data
 except ValueError:failures.append({'url':url,'error':'Invalid response'});return {}
rows=json.loads((DEST/'temple-research-candidates.json').read_text())['candidatePages'];catalog=json.loads((DEST/'temples.json').read_text())
known={t['qid'] for t in catalog}|{t.get('wikidataId') for t in catalog};urls={t.get('wikipediaUrl') for t in catalog}
titles=list(dict.fromkeys(unquote(t['sourceUrl'].split('/wiki/')[1]).replace('_',' ') for t in rows if t['sourceUrl'].startswith('https://en.wikipedia.org/wiki/') and t['sourceUrl'] not in urls and 'hindu temple' in t.get('searchDescription','').lower()))
new=[]
for i in range(0,len(titles),30):
 response=api('en.wikipedia.org',{'action':'query','prop':'coordinates|pageprops|info','inprop':'url','coprimary':'primary','redirects':1,'titles':'|'.join(titles[i:i+30])})
 for p in response.get('query',{}).get('pages',[]):
  props=p.get('pageprops',{});qid=props.get('wikibase_item');desc=props.get('wikibase-shortdesc','');coords=p.get('coordinates',[])
  if not qid or qid in known or not coords or not re.search(r'temple|shrine|mandir',desc,re.I):continue
  c=coords[0]
  if c.get('globe')!='earth' or not -90<=c['lat']<=90 or not -180<=c['lon']<=180:continue
  source=p.get('fullurl','https://en.wikipedia.org/wiki/'+p['title'].replace(' ','_'))
  known.add(qid);new.append({'qid':qid,'name':p['title'],'lat':c['lat'],'lon':c['lon'],'deity':'Not recorded','description':desc+'.','wikipediaUrl':source,'sourceUrl':'https://www.wikidata.org/wiki/'+qid,'descriptionSourceUrl':source,'descriptionLicense':'CC BY-SA 4.0','image':None,'imageFile':props.get('page_image_free'),'updatedAt':str(date.today()),'discoveredVia':'You.com'})
 print(f'Coordinate candidates processed: {min(i+30,len(titles))}/{len(titles)}; additions: {len(new)}',flush=True)
entities={}
def entities_for(ids):
 for i in range(0,len(ids),50):
  response=api('www.wikidata.org',{'action':'wbgetentities','ids':'|'.join(ids[i:i+50]),'props':'claims|labels','languages':'en'})
  entities.update(response.get('entities',{}))
entities_for([t['qid'] for t in new])
countryids=list({entities[t['qid']]['claims']['P17'][0]['mainsnak'].get('datavalue',{}).get('value',{}).get('id') for t in new if entities.get(t['qid'],{}).get('claims',{}).get('P17')}-{None})
entities_for(countryids)
for t in new:
 claim=entities.get(t['qid'],{}).get('claims',{}).get('P17',[{}])[0];cid=claim.get('mainsnak',{}).get('datavalue',{}).get('value',{}).get('id')
 t['country']=entities.get(cid,{}).get('labels',{}).get('en',{}).get('value','').replace('United States of America','United States');t['location']=t['country']
files=list(dict.fromkeys(t['imageFile'] for t in new if t.get('imageFile')));images={}
def clean(x):return html.unescape(re.sub('<[^>]*>','',x or '')).strip()
for i in range(0,len(files),30):
 response=api('commons.wikimedia.org',{'action':'query','prop':'imageinfo','titles':'|'.join('File:'+x for x in files[i:i+30]),'iiprop':'url|extmetadata','iiurlwidth':960})
 for p in response.get('query',{}).get('pages',[]):
  info=p.get('imageinfo',[{}])[0];meta=info.get('extmetadata',{});license=clean(meta.get('LicenseShortName',{}).get('value'))
  if info.get('url') and license:
   images[p['title'][5:].replace('_',' ')]={'url':info.get('thumburl') or info['url'],'sourceUrl':info['descriptionurl'],'credit':clean(meta.get('Artist',{}).get('value')) or 'Wikimedia Commons contributor','license':license,'licenseUrl':clean(meta.get('LicenseUrl',{}).get('value'))}
for t in new:
 image=images.get((t.pop('imageFile') or '').replace('_',' '))
 if image:t['image']={**image,'alt':t['name']}
catalog.extend(new)
meta=json.loads((DEST/'catalog-meta.json').read_text());meta.update({'count':len(catalog),'countries':len({t.get('country') for t in catalog if t.get('country')}),'withImages':sum(bool(t.get('image')) for t in catalog),'withWikipediaSummaries':sum(t.get('descriptionLicense')=='CC BY-SA 4.0' for t in catalog),'updatedAt':str(date.today())})
temporary=DEST/'temples.json.tmp';temporary.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n');temporary.replace(DEST/'temples.json');(DEST/'catalog-meta.json').write_text(json.dumps(meta,indent=2)+'\n');(DEST/'coordinate-import-report.json').write_text(json.dumps({'added':len(new),'candidates':len(titles),'failures':failures},indent=2)+'\n')
print(f'Added {len(new)} coordinate-confirmed temple records.',flush=True)

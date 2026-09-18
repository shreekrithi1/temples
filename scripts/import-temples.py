#!/usr/bin/env python3
"""Import public Hindu-temple records and cache source-backed details as local JSON.

Source discovery: src/data/research-sources.json (You.com).
Structured data: Wikidata CC0, with explicit Hindu-temple classification.
Descriptions: Wikipedia CC BY-SA 4.0, linked per record.
Images: Wikimedia Commons, with per-file credits and license links.

Run: python3 scripts/import-temples.py --source /path/to/sparql-results.json
Pass --refresh to refetch API response caches. No database or API key required.
"""
import argparse, concurrent.futures, hashlib, html, json, math, re, subprocess, time
from pathlib import Path
from urllib.parse import quote, unquote, urlencode

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.temple-cache'
DEST = ROOT / 'src/data'
CACHE.mkdir(exist_ok=True)
DEST.mkdir(exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--source')
parser.add_argument('--refresh', action='store_true')
args = parser.parse_args()
HEADERS = ['-A', 'MandirGlobe/1.0 (public Hindu temple atlas; local data import)']
errors = []

def request(url, label):
    file = CACHE / (hashlib.sha256(url.encode()).hexdigest()+'.json')
    if file.exists() and not args.refresh:
        return json.loads(file.read_text())
    for attempt in range(3):
        time.sleep(0.5)
        result = subprocess.run(['curl','--fail','--silent','--show-error','--location','--max-time','90', *HEADERS, url],capture_output=True)
        if result.returncode == 0:
            try:
                data = json.loads(result.stdout)
                if 'error' in data: raise ValueError(data['error'].get('info','API error'))
                file.write_text(json.dumps(data))
                return data
            except (ValueError,TypeError): pass
        time.sleep(10 * (attempt + 1) if b'429' in result.stderr else 1 + attempt * 2)
    errors.append(label)
    print('Could not fetch:', label, 'curl status', result.returncode, result.stderr.decode(errors='replace')[:150], flush=True)
    return {}

def api(domain, params, label):
    return request(f'https://{domain}/w/api.php?'+urlencode({'action':'query','format':'json','formatversion':'2',**params}),label)

def clean(value):
    return html.unescape(re.sub('<[^>]+>', '', value or '')).strip()

def val(row,key):
    v = row.get(key,{}).get('value','')
    return '' if re.fullmatch(r'Q\d+',v) else v

def image_filename(value):
    return unquote(value.rsplit('/',1)[-1]).replace('_',' ')

def normalize_deity(value):
    groups = {
        'Shiva':['shiva','śiva','siva','rudra','nataraja','mahadeva','bhairava','pashupati'],
        'Vishnu':['vishnu','viṣṇu','krishna','kṛṣṇa','rama','rāma','venkateswara','narasimha','jagannath','dhanvantari','madan mohan','narayana'],
        'Devi':['durga','durgā','kālī','kali','parvati','pārvatī','meenakshi','mariamman','bhagavati','lakshmi','saraswati','chandi','kātyāyanī','bhadrakali','kamakshi'],
        'Ganesha':['ganesha','gaṇeśa','ganesh','vinayaka','pillaiyar'],
        'Murugan':['murugan','kartikeya','kārttikeya','subramanya','skanda'],
        'Surya':['surya','sūrya','solar deity'],
        'Hanuman':['hanuman','hanumān','anjaneya'],
        'Swaminarayan':['swaminarayan'],
        'Ayyappan':['ayyappan','ayyappa'],
    }
    text=value.lower()
    for name, words in groups.items():
        if any(re.search(r'\b'+re.escape(w)+r'\b',text) for w in words): return name
    return 'Other' if value else 'Not recorded'

if args.source:
    source=json.loads(Path(args.source).read_text())
else:
    source=request('https://query.wikidata.org/sparql?'+urlencode({'query':(ROOT/'scripts/temples.rq').read_text(),'format':'json'}),'Wikidata Hindu temples')
rows=source.get('results',{}).get('bindings',[])
if not rows: raise SystemExit('No Wikidata rows; existing catalog left untouched.')
records={}
for row in rows:
    qid=val(row,'temple').rsplit('/',1)[-1]
    name=val(row,'templeLabel')
    try: lon,lat=map(float,val(row,'coord')[6:-1].split())
    except ValueError: continue
    if not name or not math.isfinite(lat) or not math.isfinite(lon) or not -90<=lat<=90 or not -180<=lon<=180: continue
    country=val(row,'countryLabel').replace('United States of America','United States')
    if country == 'Hindu temple': country = ''  # Reject a malformed upstream country claim.
    place=val(row,'placeLabel')
    r=records.setdefault(qid,{
        'qid':qid,'name':name,'lat':lat,'lon':lon,'country':country,
        'location':', '.join(dict.fromkeys(p for p in [place,country] if p)),
        'deity':'Not recorded','presidingDeity':'','architecture':'','heritage':'',
        'description':val(row,'templeDescription'),'wikipediaUrl':val(row,'article'),
        'sourceUrl':f'https://www.wikidata.org/wiki/{qid}',
        'descriptionSourceUrl':f'https://www.wikidata.org/wiki/{qid}',
        'descriptionLicense':'CC0','image':None,'imageFiles':[],
        'updatedAt':'2026-09-17',
    })
    for target,key in [('presidingDeity','deityLabel'),('architecture','architectureLabel'),('heritage','heritageLabel')]:
        value=val(row,key)
        if value and value not in r[target].split('; '): r[target]='; '.join(filter(None,[r[target],value]))
    if val(row,'image'):
        filename=image_filename(val(row,'image'))
        if filename not in r['imageFiles']: r['imageFiles'].append(filename)
    r['deity']=normalize_deity(r['presidingDeity'])

# Preserve the original hand-curated featured collection and enrich its source records.
seeds_path=ROOT/'scripts/featured-seeds.json'
seeds=json.loads(seeds_path.read_text()) if seeds_path.exists() else []
wiki_titles={
 'somnath':'Somnath_Temple','kedarnath':'Kedarnath_Temple','meenakshi':'Meenakshi_Temple',
 'tirupati':'Venkateswara_Temple,_Tirumala','brihadisvara':'Brihadisvara_Temple',
 'jagannath':'Jagannath_Temple,_Puri','kashi':'Kashi_Vishwanath_Temple',
 'ramanathaswamy':'Ramanathaswamy_Temple','pashupatinath':'Pashupatinath_Temple',
 'angkor':'Angkor_Wat','prambanan':'Prambanan','batu':'Batu_Caves',
 'mari':'Sri_Mariamman_Temple,_Singapore','nallur':'Nallur_Kandaswamy_temple',
 'siddhi':'Siddhivinayak_Temple,_Mumbai','konark':'Konark_Sun_Temple',
 'ne asden':'BAPS_Shri_Swaminarayan_Mandir_London','robbinsville':'Swaminarayan_Akshardham_(New_Jersey)',
 'mauritius':'Ganga_Talao','sydney':'Sri_Venkateswara_Temple,_Helensburgh',
}
featured=[]
for seed in seeds:
    url='https://en.wikipedia.org/wiki/'+wiki_titles[seed['qid']]
    existing=next((r for r in records.values() if r['wikipediaUrl']==url),None)
    if not existing:
        existing={**seed,'presidingDeity':seed['deity'],'wikipediaUrl':url,'sourceUrl':url,
                  'descriptionSourceUrl':url,'descriptionLicense':'Editorial summary','image':None,'imageFiles':[], 'updatedAt':'2026-09-17'}
        records[seed['qid']]=existing
    existing.update({k:v for k,v in seed.items() if k not in ['qid','lat','lon','description']})
    existing['aliases']=[seed['qid']]
    existing['featured']=True
    if not existing.get('presidingDeity'): existing['presidingDeity']=seed['deity']
    featured.append(existing)

print(f'Imported {len(records)} named Hindu temples. Enriching linked articles…',flush=True)
article_records=[r for r in records.values() if r.get('wikipediaUrl')]
batches=[article_records[i:i+20] for i in range(0,len(article_records),20)]

def enrich_articles(batch):
    titles=[unquote(r['wikipediaUrl'].split('/wiki/')[-1]).replace('_',' ') for r in batch]
    response=api('en.wikipedia.org',{'prop':'extracts|pageimages|pageprops','exintro':'1','explaintext':'1','exsentences':'4','exlimit':'20','piprop':'thumbnail|name','pithumbsize':'960','pilimit':'20','ppprop':'wikibase_item','titles':'|'.join(titles),'redirects':'1'},titles[0])
    q=response.get('query',{})
    redirects={r['from']:r['to'] for r in q.get('normalized',[])+q.get('redirects',[])}
    pages={p['title']:p for p in q.get('pages',[])}
    for r,title in zip(batch,titles):
        seen=set()
        while title in redirects and title not in seen:
            seen.add(title);title=redirects[title]
        p=pages.get(title,{})
        extract=clean(p.get('extract',''))
        if extract:
            r['description']=extract
            r['descriptionSourceUrl']='https://en.wikipedia.org/wiki/'+quote(title.replace(' ','_'),safe='(),')
            r['descriptionLicense']='CC BY-SA 4.0'
        wikibase=p.get('pageprops',{}).get('wikibase_item')
        if wikibase:
            r['wikidataId']=wikibase
            r['sourceUrl']='https://www.wikidata.org/wiki/'+wikibase
        if p.get('pageimage'):
            file=p['pageimage'].replace('_',' ')
            r['imageFiles']=[file]+[f for f in r['imageFiles'] if f!=file]
    return len(batch)

with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
    done=0
    for n in pool.map(enrich_articles,batches):
        done+=n
        if done%200==0 or done==len(article_records): print(f'Article summaries: {done}/{len(article_records)}',flush=True)

# Commons metadata is fetched for the primary image only. No guessed photo URLs.
files=list(dict.fromkeys(r['imageFiles'][0] for r in records.values() if r['imageFiles']))
image_metadata={}

def get_image_metadata(batch):
    response=api('commons.wikimedia.org',{'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':'960','titles':'|'.join('File:'+f for f in batch),'redirects':'1'},'Commons '+batch[0])
    found={}
    for p in response.get('query',{}).get('pages',[]):
        info=(p.get('imageinfo') or [{}])[0]
        if not info.get('url'): continue
        meta=info.get('extmetadata',{})
        get=lambda key:clean(meta.get(key,{}).get('value',''))
        url=info.get('thumburl') or info['url']
        found[p['title'][5:].replace('_',' ')]={
            'url':url,'sourceUrl':info.get('descriptionurl',''),
            'credit':get('Artist') or get('Credit') or 'Wikimedia Commons contributor',
            'license':get('LicenseShortName') or 'See source for image license',
            'licenseUrl':get('LicenseUrl'),'alt':'',
            'width':info.get('thumbwidth',960),'height':info.get('thumbheight',640),
        }
    return found

with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
    batches=[files[i:i+40] for i in range(0,len(files),40)]
    for i,result in enumerate(pool.map(get_image_metadata,batches)):
        image_metadata.update(result)
        if i%10==0: print(f'Image metadata batches: {i+1}/{len(batches)}',flush=True)

for r in records.values():
    if r['imageFiles']:
        photo=image_metadata.get(r['imageFiles'][0])
        if photo: r['image']={**photo,'alt':r['name']}
    r.pop('imageFiles',None)
    if not r.get('description'): r['description']=f"{r['name']} is listed as a Hindu temple in Wikidata." + (f" It is located in {r['location']}." if r.get('location') else '')
    # A sourced summary can explicitly identify a deity; don't infer from a generic name.
    if r['deity']=='Not recorded':
        match=re.search(r'dedicated to (?:the (?:Hindu )?(?:god|goddess|deity) )?(?:Lord |Goddess )?([\wāīṇṣśūṛḍ]+)',r['description'],re.I)
        if match:
            deity=normalize_deity(match.group(1))
            if deity!='Other': r['deity']=deity;r['presidingDeity']=match.group(1)

# Deduplicate seed additions that resolve to a Wikidata record already in the import.
unique={}
for r in list(featured)+list(records.values()):
    identity=r.get('wikidataId') or r['qid']
    if identity not in unique: unique[identity]=r
catalog=list(unique.values())
overrides_path=DEST/'editorial-overrides.json'
overrides=json.loads(overrides_path.read_text()) if overrides_path.exists() else {}
for record in catalog:
    if record['qid'] in overrides: record.update(overrides[record['qid']])
featured_ids=[r['qid'] for r in featured]
catalog.sort(key=lambda r:(featured_ids.index(r['qid']) if r['qid'] in featured_ids else 100,not bool(r['image']),r['name'].casefold()))
if len(catalog)<100: raise SystemExit('Import too small; existing catalog left untouched.')
manifest={
    'updatedAt':'2026-09-17','count':len(catalog),
    'countries':len(set(r.get('country') for r in catalog if r.get('country'))),
    'withImages':sum(bool(r['image']) for r in catalog),
    'withWikipediaSummaries':sum(r.get('descriptionLicense')=='CC BY-SA 4.0' for r in catalog),
    'sourceDiscovery':'You.com','structuredDataSource':'Wikidata','structuredDataLicense':'CC0',
    'descriptionSource':'Wikipedia and Wikidata','photoSource':'Wikimedia Commons',
    'classification':'Wikidata Hindu temple Q842402 and its subclasses, plus the original curated featured temples',
    'missingData':'Unavailable photos and unrecorded deities are explicitly marked; no generated photos or invented historical details.',
    'failedRequests':errors,
}
old_catalog_path=DEST/'temples.json'
if old_catalog_path.exists():
    old_images={r['qid']:r.get('image') for r in json.loads(old_catalog_path.read_text())}
    for r in catalog:
        old=old_images.get(r['qid']) or {}
        if r.get('image') and old.get('url')==r['image']['url'] and old.get('localPath'):
            r['image']['localPath']=old['localPath']
(DEST/'temples.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
(DEST/'featured-temples.json').write_text(json.dumps(catalog[:20],ensure_ascii=False,indent=2)+'\n')
(DEST/'catalog-meta.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2),flush=True)

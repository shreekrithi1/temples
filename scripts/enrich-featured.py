#!/usr/bin/env python3
"""Finish the twenty featured records with focused, cached Wikimedia requests."""
import hashlib, html, json, re, subprocess
from pathlib import Path
from urllib.parse import urlencode,unquote
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'src/data/temples.json'; data=json.loads(path.read_text()); featured=data[:20]

def api(domain,params):
    url='https://'+domain+'/w/api.php?'+urlencode({'action':'query','format':'json','formatversion':2,**params})
    cache=ROOT/'.temple-cache'/(hashlib.sha256(url.encode()).hexdigest()+'.json')
    if cache.exists(): return json.loads(cache.read_text())
    response=subprocess.run(['curl','--fail','--silent','--show-error','--location','--max-time','60','--retry','2','--retry-delay','10','-A','MandirGlobe/1.0 (public Hindu temple atlas; local data import)',url],capture_output=True)
    if response.returncode: raise RuntimeError(response.stderr.decode())
    result=json.loads(response.stdout)
    if result.get('error'): raise RuntimeError(result['error'])
    cache.write_text(json.dumps(result));return result

featured_with_articles=[t for t in featured if t.get('wikipediaUrl')]
titles=[unquote(t['wikipediaUrl'].split('/wiki/')[-1]).replace('_',' ') for t in featured_with_articles]
q=api('en.wikipedia.org',{'prop':'extracts|pageimages','exintro':1,'explaintext':1,'exsentences':4,'exlimit':20,'piprop':'name|thumbnail','pilimit':20,'pithumbsize':960,'redirects':1,'titles':'|'.join(titles)})['query']
redirects={t['from']:t['to'] for t in q.get('normalized',[])+q.get('redirects',[])}
pages={p['title']:p for p in q.get('pages',[])}
filenames={}
for record,title in zip(featured_with_articles,titles):
    seen=set()
    while title in redirects and title not in seen: seen.add(title);title=redirects[title]
    p=pages.get(title,{})
    if p.get('extract'):
        record['description']=p['extract'];record['descriptionSourceUrl']=record['wikipediaUrl'];record['descriptionLicense']='CC BY-SA 4.0'
    if p.get('pageimage'): filenames[record['qid']]=p['pageimage'].replace('_',' ')
q=api('commons.wikimedia.org',{'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':960,'titles':'|'.join('File:'+f for f in filenames.values())})['query']
images={p['title'][5:].replace('_',' '):p.get('imageinfo',[{}])[0] for p in q.get('pages',[])}
for record in featured:
    info=images.get(filenames.get(record['qid']),{})
    if not info.get('url'): continue
    meta=info.get('extmetadata',{})
    clean=lambda key:html.unescape(re.sub('<[^>]*>','',meta.get(key,{}).get('value',''))).strip()
    photo={'url':info.get('thumburl') or info['url'],'sourceUrl':info['descriptionurl'],'credit':clean('Artist') or 'Wikimedia Commons contributor','license':clean('LicenseShortName') or 'See source license','licenseUrl':clean('LicenseUrl'),'alt':record['name'],'width':info.get('thumbwidth',960),'height':info.get('thumbheight',640)}
    if record.get('image',{} ) and record['image']['url']==photo['url'] and record['image'].get('localPath'): photo['localPath']=record['image']['localPath']
    record['image']=photo
path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');(ROOT/'src/data/featured-temples.json').write_text(json.dumps(featured,ensure_ascii=False,indent=2)+'\n')
meta_path=ROOT/'src/data/catalog-meta.json';meta=json.loads(meta_path.read_text());meta['withImages']=sum(bool(t.get('image')) for t in data);meta['withWikipediaSummaries']=sum(t.get('descriptionLicense')=='CC BY-SA 4.0' for t in data);meta['featuredEnrichment']='Completed targeted Wikipedia/Commons lookup after the bulk import.';meta_path.write_text(json.dumps(meta,indent=2)+'\n')
print('Featured photos:',sum(bool(t.get('image')) for t in featured),'of',len(featured))

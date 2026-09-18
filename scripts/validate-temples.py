#!/usr/bin/env python3
"""Validate catalog identity, geography, attribution, and locally cached images."""
import json, math, re
from pathlib import Path
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
records=json.loads((ROOT/'src/data/temples.json').read_text())
meta=json.loads((ROOT/'src/data/catalog-meta.json').read_text())
assert len(records)>=1000, 'Catalog unexpectedly small'
assert len({t['qid'] for t in records})==len(records), 'Duplicate identities'
assert meta['count']==len(records), 'Stale catalog metadata'
images=0
for t in records:
    assert t['name'] and not re.fullmatch(r'Q\d+',t['name']), t['qid']
    assert isinstance(t['lat'],(float,int)) and math.isfinite(t['lat']) and -90<=t['lat']<=90, t['qid']
    assert isinstance(t['lon'],(float,int)) and math.isfinite(t['lon']) and -180<=t['lon']<=180, t['qid']
    assert t.get('description'), t['qid']
    assert t.get('sourceUrl','').startswith('https://'), t['qid']
    if t.get('descriptionLicense')=='CC BY-SA 4.0':
        assert 'wikipedia.org' in t['descriptionSourceUrl'], t['qid']
    if t.get('discoveredVia') == 'You.com':
        assert re.fullmatch(r'Q\d+', t['qid']), t['qid']
        assert t.get('wikipediaUrl', '').startswith('https://en.wikipedia.org/wiki/'), t['qid']
        assert t.get('descriptionLicense') == 'CC BY-SA 4.0', t['qid']
    if t.get('image'):
        images+=1
        image=t['image']
        assert urlparse(image['url']).hostname in ['upload.wikimedia.org','thumb.wikimedia.org'], image['url']
        assert image.get('credit') and image.get('license'), t['qid']
        assert urlparse(image['sourceUrl']).hostname=='commons.wikimedia.org', t['qid']
        if image.get('localPath'):
            assert (ROOT/'public'/image['localPath'].lstrip('/')).is_file(), t['qid']
assert images==meta['withImages'], 'Stale image metadata'
assert images>=1000, 'Photo coverage unexpectedly low'
featured=json.loads((ROOT/'src/data/featured-temples.json').read_text())
assert len(featured)==20
assert {t['qid'] for t in featured}.issubset({t['qid'] for t in records})
assert any(t['name']=='Somnath Temple' and t.get('image') for t in featured)
assert any(t['name']=='Kedarnath Temple' and t.get('image') for t in featured)
assert not any(t['name']=='National Basilica of the Sacred Heart' for t in records)
print(f'Validated {len(records):,} temples, {images:,} attributed photos, and {meta["countries"]} countries.')

#!/usr/bin/env python3
"""Stream cached query results to JSON without a giant in-memory JSON string."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];DEST=ROOT/'src/data'
files=sorted((ROOT/'.temple-cache/you-settlements').glob('*.json'))
plan=json.loads((DEST/'you-settlement-plan.json').read_text());budget=json.loads((DEST/'you-settlement-budget.json').read_text())
seen=set();total=0
for p in files:
 row=json.loads(p.read_text());seen.add(row['query']);total+=len(row['results'])
report={'provider':'You.com','completeGlobalInventory':False,'budget':budget,'successfulQueries':len(files),'resultCount':total,'unsearchedQueries':[q['query'] for q in plan['queries'] if q['query'] not in seen]}
target=DEST/'you-settlement-research.json';temp=target.with_suffix('.tmp')
with temp.open('w') as out:
 head=json.dumps(report,ensure_ascii=False);out.write(head[:-1]+',"searches":[')
 for i,p in enumerate(files):
  if i:out.write(',')
  out.write(p.read_text())
 out.write(']}\n')
temp.replace(target)
print(json.dumps({'queries':len(files),'results':total,'unsearched':len(report['unsearchedQueries']),'sizeMB':round(target.stat().st_size/1e6,1)}))

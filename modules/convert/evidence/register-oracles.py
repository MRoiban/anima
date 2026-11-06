"""Map raw native observations to the independently authored probe channels.
Reference values come exclusively from native JSON; mismatches stay findings.
"""
from pathlib import Path
import json
rows=json.load(open('modules/convert/evidence/vectors.json'))
cases=json.load(open('tests/oracle/cases.json'))
for r in rows:
 if not r.get('native'):continue
 p=Path('tests/oracle')/r['name'];raw=p/('rive/raw.txt' if (p/'rive/raw.txt').exists() else 'rive/raw.json')
 if not raw.exists():raise RuntimeError('missing native capture '+str(raw))
 v=next(v['value'] for v in json.loads(raw.read_text())['viewModel']['properties'] if v['name']=='result')
 (p/'rive/observations.json').write_text(json.dumps([dict(click=0,values={'dot.properties.result':v},events=[])],indent=2)+'\n')
 config=dict(name=r['name'],times=[0],threshold=0,maxOverPercent=0,maxDiff=0,observations=dict(script='script.txt',reference='rive/observations.json'))
 if v!=r['expected']:
  reason=f"Native observation {v!r}; independently specified Anima expectation {r['expected']!r}. "
  if r['name']=='data-converter-rounder' or 'system-degs' in r['name']:reason+='Native data-dump float32 precision differs from Anima binary64; no tolerance or numeric output is adjusted.'
  elif 'enum' in r['name']:reason+='Native enum input is happy/index 1, while the numeric bridge remains 0 with changed=false; authorable native enum converter supplies no observed value in this build.'
  else:reason+='Native boolean-to-string uses a numeric spelling; Anima specifies ECMAScript String. Parent decision remains open.'
  finding=dict(status='finding',reason=reason,case=config,observed=dict(anima=r['expected'],native=v))
  (p/'finding.json').write_text(json.dumps(finding,indent=2)+'\n')
  cases=[c for c in cases if c['name']!=r['name']]
 else:
  if not any(c['name']==r['name'] for c in cases):cases.append(config)
for kind in ['number','color']:
 p=Path('tests/oracle/data-interpolate-'+kind);refs=[]
 for i in range(6):
  raw=json.loads((p/f'rive/raw-{i}.json').read_text());v=next(v['value'] for v in raw['viewModel']['properties'] if v['name']=='result')
  if kind=='color':v='#'+v[2:]+('' if v[:2]=='FF' else v[:2]);v=v.lower()
  refs.append(dict(click=i,values={'dot.properties.result':v},events=[]))
 (p/'rive/observations.json').write_text(json.dumps(refs,indent=2)+'\n')
 config=dict(name=p.name,times=[0,.05,.1,.15],threshold=0,maxOverPercent=0,maxDiff=0,observations=dict(script='script.txt',reference='rive/observations.json'))
 reason='Native initializes lazily on the first non-default change, returning the changed value immediately; Anima initializes eagerly on first evaluation. '
 reason+='Native trace '+str([v['values']['dot.properties.result'] for v in refs])+'. '
 reason+='Independently specified Anima trace '+str([json.loads(s)['values']['dot.properties.result'] for s in (Path('spec/conformance')/p.name/'expected.jsonl').read_text().splitlines()])+'. Parent decision remains open; numeric/channel differences are retained.'
 (p/'finding.json').write_text(json.dumps(dict(status='finding',reason=reason,case=config),indent=2)+'\n')
Path('tests/oracle/cases.json').write_text(json.dumps(cases,indent=2)+'\n')
print(len(cases),'completed oracle cases; findings retained separately')

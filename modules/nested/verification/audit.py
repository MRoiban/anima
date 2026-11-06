import hashlib,json,subprocess
from pathlib import Path
base=lambda path:json.loads(subprocess.check_output(['git','show','a5fa00a40f7cdceb453a3fcb3b15cbd6f9253aba:'+path],text=True))
rows=json.loads(Path('docs/parity/inventory.json').read_text());old=base('docs/parity/inventory.json');assert [(r['id'],r['anima']['status'])for r in rows]==[(r['id'],r['anima']['status'])for r in old]
for path in ['tests/oracle/cases.json','tests/oracle/metrics.json','tests/oracle/findings-metrics.json']:
 previous=base(path);current=json.loads(Path(path).read_text());by={r['name']:r for r in current}
 for r in previous:assert by[r['name']]==r,(path,r['name'])
 print(path,len(previous),'inherited entries unchanged;',len(current)-len(previous),'additions')
print(len(rows),'parity statuses unchanged')
completed={r['name'] for r in base('tests/oracle/cases.json')}
tree=subprocess.check_output(['git','ls-tree','-rz','a5fa00a','tests/oracle'])
count=0
for entry in tree.split(b'\0'):
 if not entry:continue
 metadata,path=entry.split(b'\t',1);path=path.decode()
 if path.split('/')[2] not in completed:continue
 assert not path.endswith('.riv'),path
 blob=Path(path).read_bytes()
 digest=hashlib.sha1(b'blob '+str(len(blob)).encode()+b'\0'+blob).hexdigest()
 assert digest==metadata.decode().split()[2],path
 count+=1
print(count,'tracked files in all',len(completed),'completed baseline oracle trees unchanged')
changed=subprocess.check_output(['git','diff','--name-only','a5fa00a'],text=True).splitlines()
for path in changed:
 assert not path.startswith(tuple('modules/'+n+'/' for n in ['bind','host','host-edit','lists','assets','media','convert','motion','machine'])),path
 assert not path.startswith('tools/') or path=='tools/modules.generated.ts',path
 assert path!='packages/core/src/cond.ts',path
 assert not path.startswith(('packages/cli/src/build','packages/cli/src/import')),path
for root in ['modules/nested','modules/componentpaint']:
 for path in Path(root).rglob('*'):
  assert path.name not in ['AGENTS.md','CLAUDE.md'] and path.suffix!='.riv',str(path)
print('Ownership/binary/scaffold-documentation audit passes; no tools, thresholds or forbidden module sources changed')

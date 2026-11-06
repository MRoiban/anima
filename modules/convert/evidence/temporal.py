"""Independent temporal expectations. No reads from Anima outputs."""
from pathlib import Path
import json,html
j=lambda x:json.dumps(x,separators=(',',':'))
# Three evaluations exercise the sampling policy; LCG constants were calculated with integer arithmetic.
for name,mode in [('formula-function-random','once'),('formula-random-always','always'),('formula-random-once','once'),('formula-random-source-change','on-change')]:
 p=Path('spec/conformance/data-'+name)
 (p/'script.txt').write_text('advance 0\nsnapshot dot.properties.result\nadvance 0\nsnapshot dot.properties.result\nset $value 2\nadvance 0\nsnapshot dot.properties.result\n')
 seq=[.23645552527159452,.3692706737201661,.5042420323006809] if mode=='always' else [.23645552527159452,.23645552527159452,.3692706737201661 if mode=='on-change' else .23645552527159452]
 (p/'expected.jsonl').write_text(''.join(j(dict(time=0,values={'dot.properties.result':v},states={},events=[],settled=mode!='always'))+'\n' for v in seq))
for kind in ['number','color']:
 name='data-interpolate-'+kind
 init=0 if kind=='number' else '#000000'
 changed=10 if kind=='number' else '#ffffff'
 retarget=20 if kind=='number' else '#000000'
 xml=f'''<anima version="0.1" name="interpolate-probe" grid="20" requires="data bind convert"><model name="Root"><{kind} name="value" default="{init}"/></model><converter name="smooth" type="interpolate" duration="100" ease="linear"/><circle id="dot" cx="10" cy="10" r="1" fill="#000" properties="{html.escape(j(dict(result=dict(type=kind,default=init))),quote=True)}"/><bind target="dot.properties.result" value="$value" convert="smooth"/></anima>\n'''
 script=f'advance 0\nsnapshot dot.properties.result\nset $value {changed}\nadvance 0\nsnapshot dot.properties.result\nadvance 0.05\nsnapshot dot.properties.result\nset $value {retarget}\nadvance 0\nsnapshot dot.properties.result\nadvance 0.05\nsnapshot dot.properties.result\nadvance 0.05\nsnapshot dot.properties.result\n'
 values=[0,0,5,5,12.5,20] if kind=='number' else ['#000000','#000000','#808080','#808080','#404040','#000000']
 times=[0,0,.05,.05,.1,.15]
 for root in ['spec/conformance','tests/oracle']:
  p=Path(root)/name;(p/'todo.json').unlink(missing_ok=True);(p/'case.animl').write_text(xml);(p/'script.txt').write_text(script)
  if root=='spec/conformance':(p/'expected.jsonl').write_text(''.join(j(dict(time=t,values={'dot.properties.result':v},states={},events=[],settled=i in [0,5]))+'\n' for i,(t,v) in enumerate(zip(times,values))))
 # Self-authored RML uses the same observation bridge as the scalar probes.
 p=Path('tests/oracle')/name/'rive';p.mkdir(exist_ok=True)
 scene=Path('tests/oracle/data-calculate-ceil/rive/scene.rml').read_text()
 start=scene.index('<DataConverterOperationValue');end=scene.index('/>',start)+2
 scene=scene[:start]+'<DataConverterInterpolator id="0:80" duration="0.1" interpolationType="linear"/>'+scene[end:]
 scene=scene.replace('propertyValue="2.25"','propertyValue="0"')
 if kind=='color':
  scene=scene.replace('CustomPropertyNumber','CustomPropertyColor').replace('ViewModelPropertyNumber','ViewModelPropertyColor').replace('ViewModelInstanceNumber','ViewModelInstanceColor').replace('propertyKey="243"','propertyKey="836"').replace('propertyValue="0"','propertyValue="FF000000"')
 (p/'scene.rml').write_text(scene);(p/'rive.yaml').write_text('name: anima-'+name+'\n')
 commands=[]
 for i,command in enumerate(['advance 0',f'data value={10 if kind=="number" else "FFFFFFFF"}\nadvance 0','advance 50ms',f'data value={20 if kind=="number" else "FF000000"}\nadvance 0','advance 50ms','advance 50ms']):
  commands += [command,'data-dump '+str(p/f'raw-{i}.json')]
 (p/'commands.txt').write_text('\n'.join(commands)+'\nquit\n')
 (p/'README.md').write_text('Native numeric/colour retarget probe, authored independently; duration 0.1 seconds. Run from repository root with ~/.rive/bin/rive '+str(p)+' --commands='+str(p/'commands.txt')+'. Original raw files are retained.\n')

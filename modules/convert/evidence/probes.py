"""Independent arithmetic/string vectors and self-authored native observation scenes.
Never reads Anima output. Run from repo root; capture native outputs separately.
"""
from pathlib import Path
import json, html
q=lambda x:html.escape(str(x).lower() if isinstance(x,bool) else str(x),quote=True)
j=lambda x:json.dumps(x,separators=(',',':'))
rows=[]
def add(name,typ,value,options,expected,native=None,**kw):
 rows.append(dict(name='data-'+name,type=typ,value=value,options=options,expected=expected,native=native,**kw))
math=[('acosine',1,1,0),('asine',0,1,0),('atangent',0,1,0),('atangent2',0,1,0),('ceil',2.25,1,3),('cosine',0,1,1),('exp',0,1,1),('floor',2.75,1,2),('log',1,1,0),('modulo',5,2,1),('power',3,2,9),('round',2.25,1,2),('sine',0,1,0),('squareRoot',9,1,3),('tangent',0,1,0)]
for op,v,b,e in math:
 add('calculate-'+op.lower(),'calculate',v,dict(operation=op,operand=b),e,f'<DataConverterOperationValue id="0:80" operationType="{op}" operationValue="{b}"/>')
 fn={'power':'pow','squareRoot':'sqrt'}.get(op,op)
 if op=='modulo':
  expr='mod(value, 2)';name='formula-operator-modulo';tokens='<FormulaTokenInput/><FormulaTokenOperation operationType="modulo"/><FormulaTokenValue operationValue="2"/>'
 else:
  expr=f'{fn}(value'+(f', {b}' if op in ['power','atangent2'] else '')+')';name='formula-function-'+fn
  tokens=f'<FormulaTokenFunction functionType="{fn}"/><FormulaTokenInput/>'+(f'<FormulaTokenArgumentSeparator/><FormulaTokenValue operationValue="{b}"/>' if op in ['power','atangent2'] else '')+'<FormulaTokenParenthesisClose/>'
 add(name,'formula',v,dict(expression=expr),e,f'<DataConverterFormula id="0:80">{tokens}</DataConverterFormula>')
add('converter-boolean-negate','negate',True,{},False,'<DataConverterBooleanNegate id="0:80"/>')
add('converter-rounder','round',2.345,dict(decimals=2),2.35,'<DataConverterRounder id="0:80" decimals="2"/>')
add('converter-number-formatting','number-format',2.5,dict(decimals=2),'2.50','<DataConverterToString id="0:80" decimals="2" round="true"/>')
add('converter-string-remove-zeros','remove-zeros','2.3000',{},'2.3','<DataConverterStringRemoveZeros id="0:80"/>')
add('converter-to-number','to-number','2.5',{},2.5,'<DataConverterToNumber id="0:80"/>')
add('converter-to-string','to-string',True,{},'true','<DataConverterToString id="0:80"/>')
add('converter-enum-to-uint','enum-to-index','happy',dict(values=['calm','happy']),1,'<DataConverterEnumToUint id="0:80"/>',enum=True)
add('converter-list-to-length','list-length',None,{},2,'<DataConverterListToLength id="0:80"/>',list=True)
add('converter-range-mapper','range',.25,dict(to=[0,100],ease='linear'),25,'<DataConverterRangeMapper id="0:80" minInput="0" maxInput="1" minOutput="0" maxOutput="100"/>')
add('range-modulo','range',1.25,dict(to=[0,100],modulo=True),25,'<DataConverterRangeMapper id="0:80" minInput="0" maxInput="1" minOutput="0" maxOutput="100" modulo="true"/>')
add('range-reverse','range',.25,dict(to=[0,100],reverse=True),75,'<DataConverterRangeMapper id="0:80" minInput="0" maxInput="1" minOutput="0" maxOutput="100" reverse="true"/>')
add('converter-group','group',.126,{},13,'<DataConverterRangeMapper id="0:81" minInput="0" maxInput="1" minOutput="0" maxOutput="100"/><DataConverterRounder id="0:82"/><DataConverterGroup id="0:80"><DataConverterGroupItem converterId="0:81"/><DataConverterGroupItem converterId="0:82"/></DataConverterGroup>')
add('operation-operand-view-model','calculate',4,dict(operation='multiply',operand='$bonus'),12,'<DataConverterOperationViewModel id="0:80" operationType="multiply" sourcePathIds="0:40-0:44"/>',bonus=3)
add('bind-converter-options','calculate',4,dict(operation='multiply',operand=1),12,'<DataConverterOperationViewModel id="0:80" operationType="multiply" sourcePathIds="0:40-0:44"/>',bonus=3,bindingOptions={'operand':'$bonus'})
for mode in ['none','start','end','all']:
 add('trim-'+mode,'trim','  x  ',dict(mode=mode),{'none':'  x  ','start':'x  ','end':'  x','all':'x'}[mode],f'<DataConverterStringTrim id="0:80" trimType="{mode}"/>')
for side in ['start','end']:
 add('pad-'+side,'pad','7',dict(side=side,length=3,fill='0'),'007' if side=='start' else '700',f'<DataConverterStringPad id="0:80" padType="{side}" length="3" text="0"/>')
for name,mode in [('formula-function-random','once'),('formula-random-always','always'),('formula-random-once','once'),('formula-random-source-change','on-change')]:
 add(name,'formula',1,dict(expression='random()',random=mode),0.23645552527159452,skip='Native random has no exposed seed matching Anima’s specified uint32 LCG; direct sample equality is not a faithful counterpart. Anima sequence/policy/isolation are independently tested.')
add('converter-system-degs-to-rads','degrees-to-radians',180,{},3.141592653589793,'<DataConverterSystemDegsToRads id="0:80" operationType="multiply" operationValue="0.017453292519943295"/>')
add('converter-system-normalizer','normalize',25,{'from':[0,100]},.25,'<DataConverterSystemNormalizer id="0:80" operationType="multiply" operationValue="0.01"/>')
for name,text,nativeText,value,out in [
 ('converter-string-template','{points} pts','${points} pts',12,'12 pts'),
 ('converter-template-delimiters','[[points]] pts','[[points]] pts',12,'12 pts'),
 ('converter-template-number-formatting','{points:2:8}','${points:8.2f}',1234.5,' 1234.50'),
 ('template-argument-number','{points}','${points}',12,'12'),
 ('template-argument-string','{points}','${points}','Ada','Ada'),
]:
 kind='String' if isinstance(value,str) else 'Number'
 key=482 if kind=='String' else 483
 delimiters=' openDelimiter="[[" closeDelimiter="]]"' if name.endswith('delimiters') else ''
 native=f'<DataConverterStringTemplate id="0:80"{delimiters}><StringTemplateArgument{kind} name="points" order="a0"><DataBindContext sourcePathIds="0:40-0:44" propertyKey="{key}"/></StringTemplateArgument{kind}></DataConverterStringTemplate>'
 add(name,'template',value,dict(text=text,args={'points':'$bonus'},**({'open':'[[','close':']]'} if delimiters else {})),out,native,bonus=value,nativeInput=nativeText)
for r in rows:
 if r['name']=='data-operation-operand-view-model':r['name']='convert-model-operand'
 name=r['name']; outtype='bool' if isinstance(r['expected'],bool) else 'number' if isinstance(r['expected'],(int,float)) else 'string'
 typ='bool' if isinstance(r['value'],bool) else 'number' if isinstance(r['value'],(int,float)) else 'string'
 models=f'<model name="Root"><{typ} name="value" default="{q(j(r["value"]))}"/>'
 if r.get('enum'): models='<model name="Root"><enum name="value" values="calm happy" default="happy"/>'
 if r.get('list'): models='<model name="Item"><number name="n" default="0"/></model><model name="Root"><list name="value" of="Item" default="[{},{{}}]"/>'.replace('{{}}','{}')
 if 'bonus' in r:models+=f'<{"string" if isinstance(r["bonus"],str) else "number"} name="bonus" default="{q(j(r["bonus"]))}"/>'
 models+='</model>'
 rootdata=' data="{&quot;model&quot;:&quot;Root&quot;}"' if r.get('list') else ''
 defs={'cv':{'type':r['type'],**r['options']}}
 if r['type']=='group':defs={'map':{'type':'range','to':[0,100]},'round':{'type':'round'},'cv':{'chain':['map','round']}}
 declarations=''
 for n,d in defs.items():
  attrs=' '.join(f'{k}="{q(" ".join(map(str,v)) if isinstance(v,list) else j(v) if isinstance(v,dict) else v)}"' for k,v in d.items())
  declarations+=f'<converter-group name="{n}" {attrs}/>' if 'chain'in d else f'<converter name="{n}" {attrs}/>'
 props=j({'result':{'type':outtype,'default':False if outtype=='bool' else 0 if outtype=='number' else ''}})
 bo=' options="'+q(j(r['bindingOptions']))+'"' if r.get('bindingOptions') else ''
 xml=f'<anima version="0.1" name="converter-probe" grid="20" requires="data bind convert"{rootdata}>{models}{declarations}<circle id="dot" cx="10" cy="10" r="1" fill="#000" properties="{q(props)}"/><bind target="dot.properties.result" value="$value" convert="cv"{bo}/></anima>\n'
 script='advance 0\nsnapshot dot.properties.result\n'
 settle=r['options'].get('random')!='always'
 expected=dict(time=0,values={'dot.properties.result':r['expected']},states={},events=[],settled=settle)
 for root in ['spec/conformance','tests/oracle']:
  path=Path(root)/name;path.mkdir(exist_ok=True)
  (path/'case.animl').write_text(xml);(path/'script.txt').write_text(script)
  if root=='spec/conformance':(path/'expected.jsonl').write_text(j(expected)+'\n')
  if (path/'todo.json').exists():(path/'todo.json').unlink()
  if root=='tests/oracle' and r.get('skip'):
   (path/'skip.json').write_text(json.dumps(dict(status='skip',reason=r['skip'],tests=['spec/conformance/'+name],captureEvidence=['modules/convert/oracle/system-schema.txt' if 'system' in name else 'modules/convert/oracle/random-schema.txt']),indent=2)+'\n')
 if r['native']:
  path=Path('tests/oracle')/name/'rive';path.mkdir(exist_ok=True)
  nativeType={'number':'Number','bool':'Boolean','string':'String'}[typ];outType={'number':'Number','bool':'Boolean','string':'String'}[outtype];key={'number':243,'bool':245,'string':246}[outtype]
  if r.get('nativeInput') is not None: nativeType='String'
  value=q(r.get('nativeInput',r['value']));field='propertyValue'
  source=f'<ViewModelProperty{nativeType} id="0:42" name="value"/>';init=f'<ViewModelInstance{nativeType} viewModelPropertyId="0:42" propertyValue="{value}"/>'
  extra=''
  if 'bonus'in r:
   bonusType='String' if isinstance(r['bonus'],str) else 'Number'
   source+=f'<ViewModelProperty{bonusType} id="0:44" name="bonus"/>';init+=f'<ViewModelInstance{bonusType} viewModelPropertyId="0:44" propertyValue="{q(r["bonus"])}"/>'
  if r.get('enum'):
   source='<ViewModelPropertyEnumCustom id="0:42" name="value" enumId="0:60"/>';init='<ViewModelInstanceEnum viewModelPropertyId="0:42" propertyValue="0:62"/>';extra='<DataEnumCustom id="0:60" name="Mood"><DataEnumValue id="0:61" key="calm" value="Calm" order="a0"/><DataEnumValue id="0:62" key="happy" value="Happy" order="a1"/></DataEnumCustom>'
  if r.get('list'):
   source='<ViewModelPropertyList id="0:42" name="value"/>';init='<ViewModelInstanceList viewModelPropertyId="0:42"><ViewModelInstanceListItem viewModelInstanceId="0:71"/><ViewModelInstanceListItem viewModelInstanceId="0:72"/></ViewModelInstanceList>';extra='<ViewModel id="0:70" name="Item"><ViewModelInstance id="0:71" name="a"/><ViewModelInstance id="0:72" name="b"/></ViewModel>'
  scene=f'''<Rive version="1" kind="fragment"><Artboard id="0:1" name="Probe" width="20" height="20" viewModelId="0:40" defaultStateMachineId="0:101"><Event name="observation"><CustomProperty{outType} name="result"><DataBindContext sourcePathIds="0:40-0:42" propertyKey="{key}" converterId="0:80"/><DataBindContext sourcePathIds="0:40-0:43" propertyKey="{key}" direction="true"/></CustomProperty{outType}></Event><LinearAnimation id="0:100" name="idle" duration="60" fps="60"/><StateMachine id="0:101" name="run"><StateMachineLayer><EntryState><StateTransition stateToId="0:102"/></EntryState><AnimationState id="0:102" animationId="0:100"/></StateMachineLayer></StateMachine></Artboard><ViewModel id="0:40" name="Root" defaultInstanceId="0:41">{source}<ViewModelProperty{outType} id="0:43" name="result"/><ViewModelInstance id="0:41" name="main">{init}<ViewModelInstance{outType} viewModelPropertyId="0:43" propertyValue="{q(False if outtype=='bool' else 0 if outtype=='number' else '')}"/></ViewModelInstance></ViewModel>{extra}{r['native']}</Rive>\n'''
  (path/'scene.rml').write_text(scene);(path/'rive.yaml').write_text('name: anima-convert-'+name+'\n');(path/'commands.txt').write_text('advance 0\ndata-dump '+str(path/('raw.txt' if r.get('list') else 'raw.json'))+'\nquit\n')
  (path/'README.md').write_text('Self-authored native observation bridge; capture from the repository root with `~/.rive/bin/rive '+str(path)+' --commands='+str(path/'commands.txt')+'`. raw.json is unedited native output; observations.json maps result to dot.properties.result. No Anima values are used to create the reference.\n')
Path('modules/convert/evidence/vectors.json').write_text(json.dumps(rows,indent=2)+'\n')
print(len(rows),'vectors written')

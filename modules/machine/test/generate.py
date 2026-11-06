"""Independent, hand-calculated machine conformance vectors; no player output is used."""
import json,copy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
CASES={}
def base(states,initial='a', inputs=None, timelines=None, **rest):
 d={'anima':'0.1','name':'machine-probe','grid':20,'requires':['machine'],'inputs':inputs or {},'nodes':[{'type':'circle','id':'dot','center':[10,10],'r':1,'fill':{'color':'#4263eb'}}],'timelines':timelines or {},'machine':{'layers':{'l':{'initial':initial,'states':states}}}}
 d.update(rest);return d
def pose(x,**rest):return {'pose':{'dot.x':x},**rest}
def tr(to='b',when='go',**rest):return {'when':when,'to':to,**rest}
def timeline(a,b=None,d=2):return {'duration':d,'tracks':{'dot.x':[[0,a],[d,a if b is None else b]]}}
def snap(t,x,state,settled=True,events=None,**values):return {'time':t,'values':{'dot.x':x,**values},'states':{'l':state},'events':events or [],'settled':settled}
def case(name,doc,script,want):CASES[name]=(doc,script+'\n',want)
go={'go':{'type':'trigger'}}
case('any-state',base({'a':pose(0,on=[tr()]),'b':pose(5),'all':{'pose':{},'kind':'any','on':[tr('c')]},'c':pose(10)},inputs=go),'fire go\nadvance 0\nsnapshot dot.x',[snap(0,10,'c')])
for kind in ['blend-1d-input','blend-1d-data','blend-direct','blend-weight-constant','blend-weight-input','blend-weight-data','blend-additive']:
 data=kind.endswith('data');one=kind.startswith('blend-1d');add=kind.endswith('additive')
 axis={'bind':'level * 0.5'} if data else 'level'
 weights=[.25,.75] if kind in ['blend-direct','blend-weight-constant'] else [1,{'bind':'level * 0.5'} if data else 'level']
 mix={'mode':'1d' if one else 'additive' if add else 'direct','children':[{'play':'t0','at':0,'weight':weights[0]},{'play':'t1','at':1,'weight':weights[1]}]}
 if one:mix['axis']=axis
 doc=base({'a':{'play':'t0','mix':mix}},inputs={'level':{'type':'number'}},timelines={'t0':timeline(10 if add else 0),'t1':timeline(20 if add else 10)})
 if data:doc['requires'].append('bind')
 x=15 if add else 2.5 if one and not data else 1.25 if one else 7.5 if kind in ['blend-direct','blend-weight-constant'] else 2.5 if data else 5
 case(kind,doc,('' if kind in ['blend-direct','blend-weight-constant'] else 'set level 0.5\n')+'advance 0\nsnapshot dot.x',[snap(0,x,'a',False)])
 if kind in ['blend-direct','blend-weight-constant']:doc['inputs']={}
 # 1d input axis .5 => 5; bound axis .25 => 2.5.
 if one: CASES[kind][2][0]['values']['dot.x']=2.5 if data else 5
case('blend-exit-clock',base({'a':{'play':'t1','mix':{'mode':'direct','exit':1,'children':[{'play':'t0'},{'play':'t1'}]},'on':[tr(when='@end')]},'b':pose(20)},timelines={'t0':timeline(0,d=2),'t1':timeline(10,d=1)}),'advance 1\nsnapshot dot.x',[snap(1,20,'b')])
case('condition-artboard',base({'a':pose(0,on=[tr(when='@after(0)',guard={'left':{'artboard':'aspect'},'op':'==','right':2})]),'b':pose(10)},viewBox=[0,0,40,20]),'advance 0\nsnapshot dot.x',[snap(0,10,'b')])
doc=base({'a':pose(0,on=[tr(when='@after(0)',guard={'left':{'component':'child.count'},'op':'>','right':2})]),'b':pose(10)})
doc['requires'].append('components');doc['components']={'badge':{'grid':20,'nodes':[{'type':'circle','id':'c','center':[0,0],'r':1,'fill':{'color':'#000'}}],'inputs':{'count':{'type':'number','default':3}}}}
doc['nodes'].append({'type':'instance','id':'child','component':'badge'})
case('condition-component',doc,'advance 0\nsnapshot dot.x',[snap(0,10,'b')])
case('condition-focus',base({'a':pose(0,on=[tr(when='@after(0)',guard={'left':{'focus':'dot'},'op':'==','right':False})]),'b':pose(10)}),'advance 0\nsnapshot dot.x',[snap(0,10,'b')])
case('continue-on-exit',base({'a':{'play':'t','on':[tr(blend=1,**{'continue':True})]},'b':pose(10)},inputs=go,timelines={'t':timeline(0,10)}),'advance 0.5\nfire go\nadvance 0\nadvance 0.5\nsnapshot dot.x',[snap(1,7.5,'b',False)])
case('entry-state',base({'entry':{'pose':{},'kind':'entry','on':[tr('a',when='enabled'),tr('b',when='@after(0)')]},'a':pose(5),'b':pose(10)},initial='entry',inputs={'enabled':{'type':'bool','default':True}}),'advance 0\nsnapshot dot.x',[snap(0,5,'a')])
case('exit-state',base({'a':pose(5,on=[tr()]),'b':{'pose':{},'kind':'exit'}},inputs=go),'fire go\nadvance 0\nsnapshot dot.x\nadvance 1\nsnapshot dot.x',[snap(0,5,'b'),snap(1,5,'b')])
case('exit-time-relative',base({'a':{'play':'t','on':[tr(when='@after(0)',exitRatio=.5)]},'b':pose(10)},timelines={'t':timeline(0,8)}),'advance 0.5\nsnapshot dot.x\nadvance 0.75\nsnapshot dot.x',[snap(.5,2,'a',False),snap(1.25,10,'b')])
for kind,key in [('state-entry-actions','enterActions'),('state-exit-actions','exitActions'),('transition-actions','actions'),('transition-end-actions','endActions')]:
 action={'set':{'flag':True},'emit':kind}
 a=pose(0,on=[tr(**{key:action} if key in ['actions','endActions'] else {})]);b=pose(10)
 if key=='enterActions':b[key]=action
 if key=='exitActions':a[key]=action
 doc=base({'a':a,'b':b},inputs={**go,'flag':{'type':'bool'}})
 case(kind,doc,'fire go\nadvance 0\nsnapshot dot.x flag\nadvance 0\nsnapshot dot.x flag',[snap(0,10,'b',False,flag=False),snap(0,10,'b',True,[{'name':kind,'layer':None,'time':0}],flag=True)])
for kind in ['state-random','transition-random-weight']:
 doc=base({'a':{'pose':{},'kind':'random','on':[tr('b',when='@after(0)',weight=1),tr('c',when='@after(0)',weight=3)]},'b':pose(5),'c':pose(10)},machineSeed=1000)
 case(kind,doc,'advance 0\nsnapshot dot.x',[snap(0,10,'c')])
case('state-reset',base({'a':{'play':'t','reset':True,'on':[tr('a')]}},inputs=go,timelines={'t':timeline(0,10)}),'advance 0.5\nsnapshot dot.x\nfire go\nadvance 0\nsnapshot dot.x',[snap(.5,2.5,'a',False),snap(.5,0,'a',False)])
case('transition-disabled',base({'a':pose(0,on=[tr(disabled=True),tr('c')]),'b':pose(5),'c':pose(10)},inputs=go),'fire go\nadvance 0\nsnapshot dot.x',[snap(0,10,'c')])
case('transition-duration-relative',base({'a':{'play':'t','on':[tr(blendRatio=.25)]},'b':pose(10)},inputs=go,timelines={'t':timeline(0,10)}),'advance 0.5\nfire go\nadvance 0\nadvance 0.25\nsnapshot dot.x\nadvance 0.25\nsnapshot dot.x',[snap(.75,6.25,'b',False),snap(1,10,'b')])
for mode in ['changed','increased','decreased']:
 doc=base({'a':pose(0,on=[tr(when='@after(0)',change={'input':'count','mode':mode})]),'b':pose(10)},inputs={'count':{'type':'number','default':2}})
 value=1 if mode=='decreased' else 3
 case('machine-change-'+mode,doc,f'advance 0\nsnapshot dot.x\nset count {value}\nadvance 0\nsnapshot dot.x',[snap(0,0,'a'),snap(0,10,'b')])
# Chaining and both queued writes see only the final applied input, not intermediate values.
doc=base({'a':pose(0,on=[tr('a',when='@after(0)',change={'input':'count','mode':'increased'})])},inputs={'count':{'type':'number','default':2}})
case('machine-change-once',doc,'set count 9\nset count 2\nadvance 0\nsnapshot dot.x\nset count 8\nadvance 0\nsnapshot dot.x\nadvance 0\nsnapshot dot.x',[snap(0,0,'a'),snap(0,0,'a'),snap(0,0,'a')])
# Seams whose timing is part of Player.step, not only unit-level helper behavior.
doc=base({'all':{'pose':{},'kind':'any','on':[tr('pop',when='@after(0)',change={'input':'count','mode':'increased'})]},'idle':pose(0),'pop':pose(10,emit='pop')},initial='idle',inputs={'count':{'type':'number'}})
case('machine-change-any',doc,'set count 1\nadvance 0\nsnapshot dot.x\nset count 99\nadvance 0\nsnapshot dot.x\nadvance 0\nsnapshot dot.x',[snap(0,10,'pop',True,[{'name':'pop','layer':'l','time':0}]),snap(0,10,'pop',True,[{'name':'pop','layer':'l','time':0}]),snap(0,10,'pop')])
doc=copy.deepcopy(CASES['machine-change-increased'][0]);doc['machine']['layers']['other']=copy.deepcopy(doc['machine']['layers']['l']);expected=snap(0,10,'b');expected['states']['other']='b'
case('machine-change-layers',doc,'set count 100\nadvance 0\nsnapshot dot.x',[expected])
doc=copy.deepcopy(CASES['machine-change-changed'][0]);doc['inputs']={'count':{'type':'bool'}}
case('machine-change-bool',doc,'set count true\nadvance 0\nsnapshot dot.x',[snap(0,10,'b')])
doc=copy.deepcopy(CASES['transition-end-actions'][0]);doc['machine']['layers']['l']['states']['a']['on'][0]['blend']=1
case('machine-actions-end-clock',doc,'fire go\nadvance 0\nadvance 0.5\nsnapshot dot.x flag\nadvance 0.5\nsnapshot dot.x flag\nadvance 0\nsnapshot dot.x flag',[snap(.5,5,'b',False,flag=False),snap(1,10,'b',False,flag=False),snap(1,10,'b',True,[{'name':'transition-end-actions','layer':None,'time':0}],flag=True)])
doc=copy.deepcopy(doc);doc['inputs']['stop']={'type':'trigger'};doc['machine']['layers']['l']['states']['b']['on']=[tr('c',when='stop')];doc['machine']['layers']['l']['states']['c']=pose(20)
case('machine-actions-end-interrupt',doc,'fire go\nadvance 0\nfire stop\nadvance 0.5\nadvance 1\nadvance 0\nsnapshot dot.x flag',[snap(1.5,20,'c',flag=False)])
doc=copy.deepcopy(CASES['state-entry-actions'][0]);doc['machine']['layers']['l']['states']['a']['enterActions']={'set':{'flag':True}}
case('machine-actions-initial',doc,'advance 0\nsnapshot dot.x flag',[snap(0,0,'a',flag=True)])
doc=copy.deepcopy(CASES['blend-direct'][0]);doc['requires'].append('motion');doc['timelines']={'t0':{**timeline(0,8),'work':[.5,1.5],'speed':2,'quantize':4},'t1':{**timeline(8,16),'speed':-1,'quantize':4}}
case('machine-blend-motion-clocks',doc,'advance 0.2\nsnapshot dot.x\nadvance 1.8\nsnapshot dot.x',[snap(.2,11.4375,'a',False),snap(2,6.375,'a')])
doc=copy.deepcopy(CASES['blend-direct'][0]);doc['timelines']={'t0':{**timeline(0,8),'reducedMotion':'end'},'t1':{**timeline(8,16),'reducedMotion':'play'}}
doc['inputs']['go']={'type':'trigger'};doc['machine']['layers']['l']['states']['idle']=pose(0,on=[tr('a')]);doc['machine']['layers']['l']['initial']='idle'
case('machine-blend-reduced-children',doc,'motion reduce\nfire go\nadvance 0\nadvance 0.5\nsnapshot dot.x\nadvance 1.5\nsnapshot dot.x',[snap(.5,8,'a',False),snap(2,12.5,'a')])
for name,(doc,script,want) in CASES.items():
 slug=name if name.startswith('machine-') else 'state-machine-'+name
 path=ROOT/'spec/conformance'/slug;path.mkdir(exist_ok=True)
 (path/'case.ani').write_text(json.dumps(doc,indent=2)+'\n');(path/'script.txt').write_text(script);(path/'expected.jsonl').write_text(''.join(json.dumps(s)+'\n' for s in want));(path/'todo.json').unlink(missing_ok=True)
print(len(CASES),'independent cases written')

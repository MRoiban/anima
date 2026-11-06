"""Local-only native probes. Does not read binary files or copy documentation."""
import json,subprocess,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
RIVE=Path.home()/'.rive/bin/rive'
def anim(id,a,b=None,duration=120):
 return f'<LinearAnimation id="0:{id}" name="t{id}" fps="60" duration="{duration}"><KeyedObject objectId="0:3"><KeyedProperty property="x"><KeyFrameDouble frame="0" value="{a}" interpolationType="linear"/><KeyFrameDouble frame="{duration}" value="{a if b is None else b}"/></KeyedProperty></KeyedObject></LinearAnimation>'
def save(name,sm,animations,commands,ani,manifest):
 path=ROOT/'tests/oracle'/('state-machine-'+name);r=path/'rive';(r/'frames').mkdir(parents=True,exist_ok=True)
 node='<Node id="0:30" x="36"/>' if name=='condition-component' else ''
 sm=sm.replace(node,'') if node else sm
 (r/'scene.rml').write_text('<Rive version="1" kind="fragment"><Artboard name="Oracle" id="0:1" width="240" height="240" styleId="0:2" defaultStateMachineId="0:101" viewModelId="0:40"><LayoutComponentStyle id="0:2"/><Fill><SolidColor colorValue="FFFFFFFF"/></Fill><Shape id="0:3"><Rectangle x="24" y="96" width="24" height="48" originX="0" originY="0"/><Fill><SolidColor colorValue="FF4263EB"/></Fill></Shape>'+animations+node+'<StateMachine id="0:101" name="s">'+sm+'</StateMachine></Artboard><ViewModel id="0:40" name="Model" defaultInstanceId="0:41"><ViewModelPropertyNumber id="0:42" name="v"/><ViewModelInstance id="0:41" name="Default" exports="true"><ViewModelInstanceNumber viewModelPropertyId="0:42" propertyValue="0"/></ViewModelInstance></ViewModel></Rive>\n')
 (r/'rive.yaml').write_text('name: oracle-machine-'+name+'\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
 (r/'commands.txt').write_text(commands+'\n');(path/'case.animl').write_text(ani+'\n')
 try:
  result=subprocess.run([str(RIVE),'.','--commands=commands.txt'],cwd=r,capture_output=True,text=True)
  print(name,result.returncode,result.stdout[-700:],result.stderr[-300:],flush=True)
  if result.returncode or 'err ' in result.stdout: return
  assert all((r/'frames'/f'{t}.png').exists() for t in manifest['times'])
  cases=json.loads((ROOT/'tests/oracle/cases.json').read_text());cases=[c for c in cases if c['name']!='state-machine-'+name];cases.append({'name':'state-machine-'+name,'threshold':16,'maxDiff':2,'maxOverPercent':0,**manifest});(ROOT/'tests/oracle/cases.json').write_text(json.dumps(cases,indent=2)+'\n')
  (path/'todo.json').unlink(missing_ok=True);(r/'README.md').write_text('Independently authored native markup. Capture with the local command runner; generated binaries are deleted without reading them.\n')
 finally:
  for binary in r.rglob('*.riv'):binary.unlink()
def native_layer(state):return '<StateMachineLayer><EntryState><StateTransition stateToId="0:102"/></EntryState>'+state+'</StateMachineLayer>'
def anima(body, inputs='',timelines='',state='',requires='machine'):
 return '<anima version="0.1" name="oracle" grid="20" requires="'+requires+'">'+inputs+'<rect id="dot" x0="2" y0="8" width="2" height="4" fill="#4263eb"/>'+timelines+'<layer name="l" initial="a">'+state+'</layer></anima>'
for name,mode in [('blend-weight-constant','constant'),('blend-weight-input','input'),('blend-weight-data','data'),('blend-direct','data')]:
 c1='<BlendAnimationDirect animationId="0:100" blendSource="mixValue" mixValue="100"/>'
 c2='<BlendAnimationDirect animationId="0:110" '+('blendSource="mixValue" mixValue="25"/>' if mode=='constant' else 'blendSource="inputId" inputId="0:60"/>' if mode=='input' else 'blendSource="dataBindId"><BindablePropertyNumber><DataBindContext sourcePathIds="0:40-0:42" propertyKey="636"/></BindablePropertyNumber></BlendAnimationDirect>')
 sm=('<StateMachineNumber id="0:60" name="level" value="25"/>' if mode=='input' else '')+native_layer('<BlendStateDirect id="0:102">'+c1+c2+'</BlendStateDirect>')
 weight=.25 if mode=='constant' else 'level' if mode=='input' else {'bind':'level * 0.01'}
 state='<state name="a" play="t0" mix=\''+json.dumps({'mode':'direct','children':[{'play':'t0'},{'play':'t1','weight':weight}]})+'\'/>'
 ai=anima('', '<number name="level" default="'+('0.25' if mode=='input' else '25')+'"/>' if mode!='constant' else '', '<timeline name="t0" duration="2"><track target="dot.x">0 0;2 0</track></timeline><timeline name="t1" duration="2"><track target="dot.x">0 8;2 8</track></timeline>',state,requires='machine bind' if mode=='data' else 'machine')
 save(name,sm,anim(100,0)+anim(110,96),'data v=25\nscreenshot frames/0.png',ai,{'times':[0]})
for name,data in [('blend-1d-input',False),('blend-1d-data',True)]:
 source='<BindablePropertyNumber id="0:80"><DataBindContext sourcePathIds="0:40-0:42" propertyKey="636"/></BindablePropertyNumber>' if data else '<StateMachineNumber id="0:60" name="level" value="25"/>'
 source=source.replace('value="25"', 'value="50"')
 tag='BlendState1DViewModel' if data else 'BlendState1DInput'
 state=f'<{tag} reset="true" id="0:102" '+('' if data else 'inputId="0:60"')+'>'+ (source if data else '') + '<BlendAnimation1D animationId="0:100" value="0"/><BlendAnimation1D animationId="0:110" value="100"/></'+tag+'>'
 mix={'mode':'1d','axis':{'bind':'level'} if data else 'level','children':[{'play':'t0','at':0},{'play':'t1','at':100}]}
 ai=anima('','<number name="level" default="25"/>','<timeline name="t0" duration="2"><track target="dot.x">0 0;2 0</track></timeline><timeline name="t1" duration="2"><track target="dot.x">0 8;2 8</track></timeline>','<state name="a" play="t0" mix=\''+json.dumps(mix)+'\'/>',requires='machine bind' if data else 'machine')
 save(name,('' if data else source)+native_layer(state),anim(100,0)+anim(110,96),('data v=50\n' if data else '')+'screenshot frames/0.png\nadvance 1ms\nscreenshot frames/0.001.png',ai.replace('default="25"', 'default="50"'),{'times':[0,0.001]})
# Editor's additive family is a direct blend with a fully applied baseline.
mix={'mode':'additive','children':[{'play':'t0'},{'play':'t1','weight':.25}]}
ai=anima('','','<timeline name="t0" duration="2"><track target="dot.x">0 4;2 4</track></timeline><timeline name="t1" duration="2"><track target="dot.x">0 8;2 8</track></timeline>','<state name="a" play="t0" mix=\''+json.dumps(mix)+'\'/>')
sm=native_layer('<BlendStateDirect id="0:102" reset="true"><BlendAnimationDirect animationId="0:100" blendSource="mixValue" mixValue="100"/><BlendAnimationDirect animationId="0:110" blendSource="mixValue" mixValue="25"/></BlendStateDirect>')
save('blend-additive',sm,anim(100,48)+anim(110,96),'screenshot frames/0.png\nadvance 1ms\nscreenshot frames/0.001.png',ai,{'times':[0,.001]})
# Timed transitions compare the same exact boundaries in seconds and native milliseconds/percent.
for name in ['continue-on-exit','exit-time-relative','transition-duration-relative','state-reset','transition-disabled','entry-state','any-state','condition-artboard','condition-component','blend-exit-clock','exit-state']:
 animations=anim(100,0,96)+anim(110,96)+anim(120,48)
 timelines='<timeline name="t0" duration="2"><track target="dot.x">0 0;2 8</track></timeline><timeline name="t1" duration="2"><track target="dot.x">0 8;2 8</track></timeline><timeline name="t2" duration="2"><track target="dot.x">0 4;2 4</track></timeline>'
 commands='screenshot frames/0.png\nadvance 500ms\nscreenshot frames/0.5.png\nadvance 250ms\nscreenshot frames/0.75.png\nadvance 750ms\nscreenshot frames/1.5.png';times=[0,.5,.75,1.5]
 flags='';extra='';native_cond='';ani_cond='';dest='0:112';target='b';native_tag='StateTransition'
 ani_attrs='';ani_when='@after(0.5)'
 if name=='continue-on-exit':flags='duration="1000" enableExitTime="true" exitTime="500" pauseOnExit="false"';ani_attrs='blend="1" continue="true"'
 elif name=='exit-time-relative':flags='enableExitTime="true" exitTime="25" exitTimeIsPercetange="true" duration="0"';ani_attrs='exitRatio="0.25"';ani_when='@after(0)'
 elif name=='transition-duration-relative':flags='duration="50" durationIsPercentage="true" enableExitTime="true" exitTime="500" pauseOnExit="true"';ani_attrs='blendRatio="0.5"'
 elif name=='state-reset':flags='duration="0" enableExitTime="true" exitTime="500"';dest='0:102';target='a'
 elif name=='transition-disabled':flags='disabled="true"';extra='<StateTransition stateToId="0:122"/>';ani_when='@after(0)'
 elif name=='entry-state':flags='';ani_when='@after(0)'
 elif name in ['any-state','condition-artboard','condition-component']:
  ani_when='@after(0)';flags='';commands='data v=25\nscreenshot frames/0.png';times=[0]
  if name=='condition-artboard':native_cond='<TransitionArtboardCondition opValue="greaterThan"><TransitionPropertyArtboardComparator propertyType="width"/><TransitionValueNumberComparator value="120"/></TransitionArtboardCondition>';ani_attrs='guard=\''+json.dumps({'left':{'artboard':'width'},'op':'>','right':10})+'\''
  elif name=='condition-component':native_cond='<TransitionViewModelCondition opValue="greaterThan"><TransitionPropertyComponentComparator objectId="0:30" propertyKey="13"/><TransitionValueNumberComparator value="24"/></TransitionViewModelCondition>';ani_attrs='guard=\''+json.dumps({'left':{'component':'child.count'},'op':'>','right':2})+'\'';extra='<Node id="0:30" x="36"/>'
  else:native_cond='<TransitionViewModelCondition opValue="greaterThan"><TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext sourcePathIds="0:40-0:42" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="10"/></TransitionViewModelCondition>';ani_when='level > 10'
 elif name=='blend-exit-clock':native_tag='BlendStateTransition';flags='exitBlendAnimationId="0:202" enableExitTime="true" exitTime="25" exitTimeIsPercetange="true"';ani_attrs='exitRatio="0.25"';ani_when='@after(0)'
 native_tr=f'<{native_tag} stateToId="{dest}" {flags}>{native_cond}</{native_tag}>'
 ani_tr=f'<on when="{ani_when}" to="{target}" {ani_attrs}/>'
 state=f'<state name="a" play="t0" reset="true">{ani_tr}</state><state name="b" play="t1"/><state name="c" play="t2"/>'
 sm=native_layer(f'<AnimationState id="0:102" animationId="0:100" reset="true">{native_tr}{extra if name=="transition-disabled" else ""}</AnimationState><AnimationState id="0:112" animationId="0:110"/><AnimationState id="0:122" animationId="0:120"/>')
 if name=='exit-state':
  flags='enableExitTime="true" exitTime="500"'
  sm=native_layer('<AnimationState id="0:102" animationId="0:100" reset="true"><StateTransition stateToId="0:112" enableExitTime="true" exitTime="500"/></AnimationState><ExitState id="0:112"/>')
  state='<state name="a" play="t0"><on when="@after(0.5)" to="b"/></state><state name="b" kind="exit"/>'
 if name=='transition-disabled':state='<state name="a" play="t0">'+ani_tr+'<on when="@after(0)" to="c"/></state><state name="b" play="t1"/><state name="c" play="t2"/>';ani_tr=ani_tr.replace('/>',' disabled="true"/>');state=state.replace('<on when="@after(0)" to="b" />',ani_tr)
 if name=='entry-state':sm='<StateMachineLayer><EntryState>'+native_tr+'</EntryState><AnimationState id="0:112" animationId="0:110"/></StateMachineLayer>';state='<state name="a" kind="entry">'+ani_tr+'</state><state name="b" play="t1"/>'
 if name=='any-state':sm=native_layer('<AnyState>'+native_tr+'</AnyState><AnimationState id="0:102" animationId="0:100"/><AnimationState id="0:112" animationId="0:110"/>');state='<state name="all" kind="any">'+ani_tr+'</state><state name="a" play="t0"/><state name="b" play="t1"/>'
 if name=='blend-exit-clock':
  sm=native_layer('<BlendStateDirect id="0:102" reset="true"><BlendAnimationDirect id="0:201" animationId="0:110" blendSource="mixValue" mixValue="100"/><BlendAnimationDirect id="0:202" animationId="0:100" blendSource="mixValue" mixValue="0"/>'+native_tr+'</BlendStateDirect><AnimationState id="0:112" animationId="0:110"/>')
  state='<state name="a" play="t0" mix=\''+json.dumps({'mode':'direct','exit':1,'children':[{'play':'t1'},{'play':'t0','weight':0}]})+'\'>'+ani_tr+'</state><state name="b" play="t1"/>'
 if name!='transition-disabled':state=state.replace('<state name="c" play="t2"/>','')
 if name=='state-reset':state=state.replace('<state name="b" play="t1"/>','')
 ai=anima('','<number name="level" default="25"/>' if name=='any-state' else '',timelines,state)
 if name=='condition-component':
  ai=ai.replace('requires="machine"','requires="machine components"').replace('<rect id="dot"','<component name="badge" grid="20"><number name="count" default="3"/><circle id="c" cx="0" cy="0" r="1" fill="#000" opacity="0"/></component><instance id="child" component="badge"/><rect id="dot"');sm=extra+sm
 manifest={'times':times}
 if name in ['transition-duration-relative','exit-state']:manifest['scripts']={'0.75':'advance 0.5\nadvance 0.25','1.5':'advance 0.5\nadvance 0.25\nadvance 0.75'}
 if name=='state-reset':
  sm=native_layer('<AnimationState id="0:102" animationId="0:100" reset="true"><StateTransition stateToId="0:112" enableExitTime="true" exitTime="500"/></AnimationState><AnimationState id="0:112" animationId="0:110"><StateTransition stateToId="0:102" enableExitTime="true" exitTime="250"/></AnimationState>')
  state='<state name="a" play="t0" reset="true"><on when="@after(0.5)" to="b"/></state><state name="b" play="t1"><on when="@after(0.25)" to="a"/></state>'
  ai=anima('','',timelines,state);commands='screenshot frames/0.png\nadvance 500ms\nscreenshot frames/0.5.png\nadvance 250ms\nscreenshot frames/0.75.png\nadvance 250ms\nscreenshot frames/1.png';manifest={'times':[0,.5,.75,1]}
 save(name,sm,animations,commands,ai,manifest)

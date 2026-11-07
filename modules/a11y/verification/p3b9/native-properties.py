"""[P3b-9] Independently authored property and remaining state probe."""
from pathlib import Path
p=Path('modules/a11y/oracle/roles/properties');p.mkdir(exist_ok=True);(p/'frames').mkdir(exist_ok=True)
s='<Rive version="1" kind="fragment"><Artboard id="0:1" name="Properties" width="100" height="100" viewModelId="0:40" defaultStateMachineId="0:2"><FocusData canFocus="false"/>'
def bind(prop,key):return f'<DataBindContext sourcePathIds="0:40-0:{prop}" propertyKey="{key}"/>'
def shape(id,name,role,y,attrs='',bindings=''):
 return f'<Shape id="0:{id}" name="{name}" x="10" y="{y}"><SemanticData role="{role}" label="{name}" {attrs}>{bindings}</SemanticData><Rectangle width="4" height="4"/><Fill><SolidColor colorValue="FF111111"/></Fill></Shape>'
s+=shape(20,'control','button',10)
s+=shape(21,'copy','text',20,'isLiveRegion="true"',bind(42,983)+bind(43,985)+bind(44,984))
s+=shape(22,'check','checkbox',30,'isRequirable="true"',bind(45,998)+bind(46,1001)+bind(46,1006))
s+=shape(23,'heading','text',40,'headingLevel="2"')
s+='<Node name="transparent"><SemanticData role="none"/>'+shape(24,'lifted','text',50)+'</Node>'
s+=shape(25,'hidden','image',60,'',bind(46,1004))
s+=shape(26,'modal','dialog',70,'',bind(46,1007))
s+='<LinearAnimation id="0:3" name="Idle" duration="60" fps="60"/><StateMachine id="0:2" name="Actions"><StateMachineListener targetId="0:20"><ListenerInputTypeSemantic listenerTypeValue="semanticAction"><SemanticInput actionType="tap"/></ListenerInputTypeSemantic>'
for prop,typ,key,v in [(42,'String',635,'After'),(43,'String',635,'More'),(44,'String',635,'Changed'),(45,'Number',636,'2'),(46,'Boolean',634,'true')]:
 s+=f'<ListenerViewModelChange><BindableProperty{typ} propertyValue="{v}"><DataBindContext sourcePathIds="0:40-0:{prop}" propertyKey="{key}" direction="true"/></BindableProperty{typ}></ListenerViewModelChange>'
s+='</StateMachineListener><StateMachineLayer><EntryState><StateTransition stateToId="0:4"/></EntryState><AnimationState id="0:4" animationId="0:3"><FocusActionTarget targetId="0:20"/></AnimationState></StateMachineLayer></StateMachine></Artboard><ViewModel id="0:40" name="State" defaultInstanceId="0:41">'
for id,name,typ in [(42,'title','String'),(43,'help','String'),(44,'value','String'),(45,'check','Number'),(46,'flag','Boolean')]:s+=f'<ViewModelProperty{typ} id="0:{id}" name="{name}"/>'
s+='<ViewModelInstance id="0:41" name="main" exports="true">'
for id,typ,v in [(42,'String','Before'),(43,'String','Help'),(44,'String','Value'),(45,'Number','0'),(46,'Boolean','false')]:s+=f'<ViewModelInstance{typ} viewModelPropertyId="0:{id}" propertyValue="{v}"/>'
s+='</ViewModelInstance></ViewModel></Rive>\n'
(p/'scene.rml').write_text(s);(p/'rive.yaml').write_text('name: anima-semantic-properties\n')
(p/'commands.txt').write_text('advance 0\nsemantics frames/before.json\nsemantic-action tap@control\nadvance 0\nadvance 0\nsemantics frames/after.json\nquit\n')

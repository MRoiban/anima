from pathlib import Path
import math
out=[]
serial=1000
def emit(s): out.append(s)
def uid():
 global serial
 serial+=1
 return f'0:{serial}'
def bind(prop,key,extra=''):
 return f'<DataBindContext sourcePathIds="0:10-0:{prop}" propertyKey="{key}" {extra}/>'
def paint(color='FF141413',stroke=False):
 return f'<Stroke thickness="12" cap="round" join="round"><SolidColor colorValue="{color}"/></Stroke>' if stroke else f'<Fill><SolidColor colorValue="{color}"/></Fill>'
def path(points,closed=False):
 return f'<PointsPath isClosed="{str(closed).lower()}">'+''.join(f'<StraightVertex x="{x}" y="{y}"/>' for x,y in points)+'</PointsPath>'
def keys(obj,key,values):
 return f'<KeyedObject objectId="0:{obj}"><KeyedProperty propertyKey="{key}">'+''.join(f'<KeyFrameDouble frame="{f}" value="{v}" interpolationType="linear"/>' for f,v in values)+'</KeyedProperty></KeyedObject>'
def copy(src,dst,conv=None,boolean=False):
 ident=uid(); key=634 if boolean else 636; typ='Boolean' if boolean else 'Number'
 return f'<ListenerViewModelChange fromViewModelProperty="true" fromDataBindId="{ident}"><BindableProperty{typ}>'+bind(src,key,f'id="{ident}"'+(f' converterId="0:{conv}"' if conv else ''))+bind(dst,key,'direction="true"')+f'</BindableProperty{typ}></ListenerViewModelChange>'
def compare(a,b,op):
 return f'<TransitionViewModelCondition opValue="{op}">'+''.join('<TransitionPropertyViewModelComparator><BindablePropertyNumber>'+bind(p,636)+'</BindablePropertyNumber></TransitionPropertyViewModelComparator>' for p in (a,b))+'</TransitionViewModelCondition>'
def transition(to,op):
 return f'<StateTransition stateToId="0:{to}" duration="0">'+compare(11,13,op)+copy(11,13)+'</StateTransition>'
emit('<Rive version="1" kind="fragment">')
emit('<Artboard width="480" height="144" name="Volume" id="0:1" viewModelId="0:10" viewModelInstanceId="0:14" defaultStateMachineId="0:2" styleId="0:3"><LayoutComponentStyle id="0:3"/>')
# First sibling paints on top.
emit('<Shape name="Mute slash" opacity="0" id="0:25">'+bind(12,18,'converterId="0:85"')+path([(24,24),(108,120)])+paint('FFD97757',True)+'</Shape>')
emit('<Shape x="288" y="72" name="Knob" id="0:20"><FocusData/>'+bind(11,13,'converterId="0:80"')+'<Ellipse width="36" height="36"/>'+paint('FFD97757')+'<TranslationConstraint doesCopy="false" doesCopyY="false" min="true" max="true" minValue="144" maxValue="432" minY="true" maxY="true" minValueY="72" maxValueY="72"/></Shape>')
emit('<Shape x="144" y="72" name="Accent fill"><Rectangle width="144" height="12" originX="0">'+bind(11,20,'converterId="0:81"')+'</Rectangle>'+paint('FFD97757')+'</Shape>')
emit('<Shape name="Track">'+path([(144,72),(432,72)])+paint(stroke=True)+'</Shape>')
emit('<Node name="Waves" id="0:24">'+bind(12,18,'converterId="0:86"'))
# Exact circular arcs via cubic quarter-circle pieces, not polylines.
for i,r in enumerate((24,42,60)):
 d=4/3*math.tan(math.pi/8)*r
 a=r/math.sqrt(2)
 emit(f'<Shape name="Wave {i+1}" id="0:{30+i}" opacity="0"><PointsPath>')
 emit(f'<CubicDetachedVertex x="{96+a}" y="{72-a}" outRotation="{math.pi/4}" outDistance="{d}"/>')
 emit(f'<CubicDetachedVertex x="{96+a}" y="{72+a}" inRotation="{-math.pi/4}" inDistance="{d}"/>')
 emit('</PointsPath>'+paint(stroke=True)+'</Shape>')
emit('</Node>')
emit('<Node x="60" y="72" name="Speaker pulse" id="0:21">')
emit('<Shape name="Speaker" id="0:22">'+path([(-36,-24),(0,-24),(36,-48),(36,48),(0,24),(-36,24)],True)+paint()+'</Shape></Node>')
emit('<StateMachine name="Volume interaction" id="0:2">')
emit('<StateMachineListenerSingle targetId="0:20" listenerTypeValue="down" name="Remember grab"><ListenerViewModelChange inputValue="pointerX"><BindablePropertyNumber>'+bind(15,636,'direction="true" converterId="0:88"')+'</BindablePropertyNumber></ListenerViewModelChange></StateMachineListenerSingle>')
emit('<StateMachineListener targetId="0:20" name="Drag from grab"><ListenerInputType listenerTypeValue="dragStart"/><ListenerInputType listenerTypeValue="drag"/><ListenerViewModelChange inputValue="pointerX"><BindablePropertyNumber>'+bind(11,636,'direction="true" converterId="0:89"')+'</BindablePropertyNumber></ListenerViewModelChange></StateMachineListener>')
for key,c in [('right',83),('left',84)]:
 emit(f'<StateMachineListener targetId="0:20" name="Step {key}"><ListenerInputTypeKeyboard listenerTypeValue="keyboard"><KeyboardInput keyType="{key}" keyPhase="3"/></ListenerInputTypeKeyboard>'+copy(11,11,c)+'</StateMachineListener>')
emit('<StateMachineListenerSingle targetId="0:22" listenerTypeValue="click" name="Mute toggle">'+copy(12,12,82,True)+'</StateMachineListenerSingle>')
emit('<StateMachineLayer name="Wave blend"><AnyState x="200" y="-100"/><ExitState x="400" y="-100"/><EntryState><StateTransition stateToId="0:40"/></EntryState><BlendState1DViewModel x="200" y="0" id="0:40"><FocusActionTarget targetId="0:20"/><BindablePropertyNumber>'+bind(11,636,'converterId="0:87"')+'</BindablePropertyNumber>')
for i,v in enumerate((0,33,66,100)):
 emit(f'<BlendAnimation1D animationId="0:{50+i}" value="{v}"/>')
emit('</BlendState1DViewModel></StateMachineLayer>')
emit('<StateMachineLayer name="Increase pulse"><AnyState x="200" y="-100"/><ExitState x="400" y="-100"/><EntryState><StateTransition stateToId="0:60"/></EntryState>')
for state,anim,other in [(60,70,61),(61,71,62),(62,71,61),(63,70,61)]:
 emit(f'<AnimationState x="{(state-59)*200}" y="0" id="0:{state}" animationId="0:{anim}" reset="true">'+transition(other,'greaterThan')+transition(63 if state==60 else 60,'lessThan')+'</AnimationState>')
emit('</StateMachineLayer></StateMachine>')
for i in range(4):
 emit(f'<LinearAnimation name="Wave pose {i}" id="0:{50+i}" fps="60" duration="1">')
 for j in range(3): emit(keys(30+j,18,[(0,1 if j<i else 0)]))
 emit('</LinearAnimation>')
for ident,name,vals in [(70,'Rest',[(0,1)]),(71,'Pulse',[(0,1),(6,1.08),(12,1)])]:
 emit(f'<LinearAnimation name="{name}" id="0:{ident}" fps="60" duration="12">'+keys(21,16,vals)+keys(21,17,vals)+'</LinearAnimation>')
emit('</Artboard>')
emit('<ViewModel name="Volume" id="0:10" defaultInstanceId="0:14"><ViewModelPropertyNumber name="volume" id="0:11"/><ViewModelPropertyBoolean name="muted" id="0:12"/><ViewModelPropertyNumber name="previousVolume" id="0:13"/><ViewModelPropertyNumber name="grabOffset" id="0:15"/><ViewModelInstance name="Default" id="0:14" exports="true"><ViewModelInstanceNumber viewModelPropertyId="0:11" propertyValue="0.5"/><ViewModelInstanceBoolean viewModelPropertyId="0:12" propertyValue="false"/><ViewModelInstanceNumber viewModelPropertyId="0:13" propertyValue="0.5"/><ViewModelInstanceNumber viewModelPropertyId="0:15" propertyValue="0"/></ViewModelInstance></ViewModel>')
for ident,mx in [(80,432),(81,288),(87,100)]:
 emit(f'<DataConverterRangeMapper name="Range {ident}" id="0:{ident}" minInput="0" maxInput="1" minOutput="{144 if ident==80 else 0}" maxOutput="{mx}" clampLower="true" clampUpper="true"/>')
emit('<DataConverterBooleanNegate name="Toggle" id="0:82"/>')
for ident,step in [(83,.1),(84,-.1)]:
 emit(f'<DataConverterFormula name="Step {step}" id="0:{ident}"><FormulaTokenFunction functionType="0"/><FormulaTokenValue operationValue="1"/><FormulaTokenArgumentSeparator/><FormulaTokenFunction functionType="1"/><FormulaTokenValue operationValue="0"/><FormulaTokenArgumentSeparator/><FormulaTokenInput/><FormulaTokenOperation operationType="0"/><FormulaTokenValue operationValue="{step}"/><FormulaTokenParenthesisClose/><FormulaTokenParenthesisClose/></DataConverterFormula>')
emit('<DataConverterToNumber name="Muted opacity" id="0:85"/>')
emit('<DataConverterGroup name="Unmuted opacity" id="0:86"><DataConverterGroupItem converterId="0:82"/><DataConverterGroupItem converterId="0:85"/></DataConverterGroup>')
# pointerX - 144 - volume * 288; then clamp((pointerX - grabOffset - 144)/288).
value=lambda v:f'<FormulaTokenValue operationValue="{v}"/>'
op=lambda n:f'<FormulaTokenOperation operationType="{n}"/>'
vm=lambda p:'<FormulaTokenValue>'+bind(p,777)+'</FormulaTokenValue>'
emit('<DataConverterFormula name="Grab offset" id="0:88"><FormulaTokenInput/>'+op(1)+value(144)+op(1)+vm(11)+op(2)+value(288)+'</DataConverterFormula>')
emit('<DataConverterFormula name="Drag volume" id="0:89"><FormulaTokenFunction functionType="0"/>'+value(1)+'<FormulaTokenArgumentSeparator/><FormulaTokenFunction functionType="1"/>'+value(0)+'<FormulaTokenArgumentSeparator/><FormulaTokenParenthesisOpen/><FormulaTokenInput/>'+op(1)+vm(15)+op(1)+value(144)+'<FormulaTokenParenthesisClose/>'+op(3)+value(288)+'<FormulaTokenParenthesisClose/><FormulaTokenParenthesisClose/></DataConverterFormula>')
emit('</Rive>')
Path(__file__).with_name('scene.rml').write_text('\n'.join(out)+'\n')

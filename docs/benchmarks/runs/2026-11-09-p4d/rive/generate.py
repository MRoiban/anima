from pathlib import Path
import math, struct, wave
root = Path(__file__).parent / 'share'
s = ['<Rive version="1" kind="fragment">', '<Artboard width="240" height="240" name="Share" id="0:1" viewModelId="0:100" defaultStateMachineId="0:10" styleId="0:2"><LayoutComponentStyle id="0:2"/>']
def add(x): s.append(x)
def bind(prop, key, **kw):
    attrs = ' '.join(f'{k}="{v}"' for k,v in kw.items())
    return f'<DataBindContext sourcePathIds="0:100-0:{prop}" propertyKey="{key}" {attrs}/>'
def cond(prop, kind='Number', value='0', converter=None, op='equal'):
    key = 636 if kind == 'Number' else 686
    b = bind(prop,key,**({'converterId':converter} if converter else {}))
    return f'<TransitionViewModelCondition opValue="{op}"><TransitionPropertyViewModelComparator><BindableProperty{kind}>{b}</BindableProperty{kind}></TransitionPropertyViewModelComparator><TransitionValue{kind}Comparator '+ (f'value="{value}"' if kind=='Number' else '') + '/></TransitionViewModelCondition>'
for i,(x,y) in enumerate([(60,120),(180,60),(180,180)]):
    add(f'<Node x="{x}" y="{y}" id="0:{20+i}" name="Circle{i+1}"><Shape><Ellipse width="48" height="48" originX="0.5" originY="0.5"/><Fill><SolidColor colorValue="FF141413"/></Fill></Shape></Node>')
for y in [60,180]:
    add(f'<Shape><PointsPath><StraightVertex x="60" y="120"/><StraightVertex x="180" y="{y}"/></PointsPath><Stroke thickness="18"><SolidColor colorValue="FF141413"/></Stroke></Shape>')
add('<Shape id="0:30" name="Click area"><Rectangle width="240" height="240" originX="0" originY="0"/><Fill><SolidColor colorValue="00000000"/></Fill></Shape>')
add('<Event name="shared" id="0:40"><CustomPropertyNumber name="count">'+bind(102,243)+'</CustomPropertyNumber><CustomPropertyString name="channel" propertyValue="button"/></Event>')
add('<Event name="pulse-done" id="0:41"/>')
add('<Event name="milestone" id="0:42"><CustomPropertyString name="url" propertyValue="https://example.org/thanks"/><CustomPropertyString name="target" propertyValue="_blank"/></Event>')
add('<AudioEvent name="click-tone" id="0:43" assetId="0:200"/>')
add('<StateMachine name="Share" id="0:10">')
add('<StateMachineListenerSingle targetId="0:30" listenerTypeValue="click" name="Share click">')
add('<ListenerViewModelChange fromViewModelProperty="true" fromDataBindId="0:80"><BindablePropertyNumber>'+bind(102,636,id='0:80',converterId='0:201')+bind(102,636,direction='true')+'</BindablePropertyNumber></ListenerViewModelChange>')
add('<ListenerViewModelChange><BindablePropertyTrigger>'+bind(103,686,direction='true')+'</BindablePropertyTrigger></ListenerViewModelChange>')
add('</StateMachineListenerSingle>')
add('<StateMachineLayer name="Pulse"><AnyState x="0" y="-100"/><ExitState x="400" y="-100"/><EntryState x="-200" y="0"><StateTransition stateToId="0:50"/></EntryState>')
add('<AnimationState id="0:50" x="0" y="0" animationId="0:60"><StateTransition stateToId="0:51">'+cond(103,'Trigger')+'</StateTransition></AnimationState>')
for state,other,x in [(51,52,200),(52,51,400)]:
    add(f'<AnimationState id="0:{state}" x="{x}" y="0" animationId="0:61" reset="true"><StateMachineFireEvent eventId="0:40"/><StateMachineFireEvent eventId="0:43"/><StateTransition stateToId="0:{other}">'+cond(103,'Trigger')+'</StateTransition></AnimationState>')
add('</StateMachineLayer>')
add('<StateMachineLayer name="Milestones"><AnyState x="0" y="-100"/><ExitState x="400" y="-100"/><EntryState x="-200" y="0"><StateTransition stateToId="0:70"/></EntryState>')
add('<AnimationState id="0:70" x="0" y="0" animationId="0:62"><StateTransition stateToId="0:71">'+cond(103,'Trigger')+cond(102,converter='0:202')+cond(102,op='greaterThan')+'</StateTransition></AnimationState>')
add('<AnimationState id="0:71" x="200" y="0" animationId="0:62" reset="true"><StateMachineFireEvent eventId="0:42"/><StateTransition stateToId="0:70" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/></AnimationState></StateMachineLayer></StateMachine>')
for anim in [60,61]:
    add(f'<LinearAnimation id="0:{anim}" name="'+('Rest' if anim==60 else 'Pulse')+f'" fps="60" duration="{1 if anim==60 else 24}" loopValue="oneShot">')
    for i in range(3):
        add(f'<KeyedObject objectId="0:{20+i}">')
        for prop in ['scaleX','scaleY']:
            add(f'<KeyedProperty property="{prop}">')
            keys = [(0,1)] if anim==60 else sorted(set([(0,1),(i*3,1),(i*3+9,1.3),(i*3+18,1)]))
            for f,v in keys: add(f'<KeyFrameDouble frame="{f}" value="{v}" interpolationType="linear"/>')
            add('</KeyedProperty>')
        add('</KeyedObject>')
    if anim==61: add('<KeyedObject objectId="0:41"><KeyedProperty property="trigger"><KeyFrameCallback frame="24"/></KeyedProperty></KeyedObject>')
    add('</LinearAnimation>')
add('<LinearAnimation id="0:62" name="Milestone wait" duration="1" fps="60" loopValue="oneShot"/></Artboard>')
add('<ViewModel id="0:100" name="Share" defaultInstanceId="0:101"><ViewModelPropertyNumber id="0:102" name="count"/><ViewModelPropertyTrigger id="0:103" name="click"/><ViewModelInstance id="0:101" name="Default" exports="true"><ViewModelInstanceNumber viewModelPropertyId="0:102" propertyValue="0"/><ViewModelInstanceTrigger viewModelPropertyId="0:103"/></ViewModelInstance></ViewModel>')
add('<DataConverterOperationValue id="0:201" name="Increment" operationType="add" operationValue="1"/><DataConverterOperationValue id="0:202" name="Every fifth" operationType="modulo" operationValue="5"/><AudioAsset file="click.wav" name="click" id="0:200"/></Rive>')
(root/'scene.rml').write_text('\n'.join(s)+'\n')
with wave.open(str(root/'click.wav'),'wb') as w:
    w.setparams((1,2,44100,0,'NONE','not compressed'))
    w.writeframes(b''.join(struct.pack('<h',round(9000*math.sin(2*math.pi*880*i/44100)*math.exp(-i/700))) for i in range(4410)))

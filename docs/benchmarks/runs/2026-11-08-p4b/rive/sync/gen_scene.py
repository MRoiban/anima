"""Generate the benchmark scene; no external assets or runtime scripts."""
from pathlib import Path
from math import cos, sin, pi, tan
from xml.etree.ElementTree import Element, SubElement as S, indent, tostring

root = Element('Rive', version='1', kind='fragment')
def el(parent, tag, **attrs):
    return S(parent, tag, {k: str(v) for k,v in attrs.items()})
def bind(parent, prop, key, **attrs):
    return el(parent, 'DataBindContext', sourcePathIds=f'0:40-0:{prop}', propertyKey=key, **attrs)
def action(parent, prop, value, boolean=False):
    a = el(parent, 'ListenerViewModelChange')
    b = el(a, 'BindablePropertyBoolean' if boolean else 'BindablePropertyNumber', propertyValue=value)
    bind(b, prop, 634 if boolean else 636, direction='true')
def condition(parent, prop, value):
    c = el(parent, 'TransitionViewModelCondition')
    a = el(c, 'TransitionPropertyViewModelComparator')
    bind(el(a, 'BindablePropertyBoolean'), prop, 634)
    el(c, 'TransitionValueBooleanComparator', value=value)
def transition(parent, dest, conditions=(), wait=False):
    attrs = dict(stateToId=f'0:{dest}', duration=0)
    if wait:
        attrs.update(enableExitTime='true', exitTimeIsPercetange='true', exitTime=100)
    t = el(parent, 'StateTransition', **attrs)
    for prop,value in conditions:
        condition(t, prop, value)
    return t
def animation(parent, ident, name, duration=1, loop='oneShot'):
    return el(parent, 'LinearAnimation', id=f'0:{ident}', name=name, fps=60, duration=duration, loopValue=loop)
def key(anim, obj, prop, pairs, elastic=False):
    o = el(anim, 'KeyedObject', objectId=f'0:{obj}')
    p = el(o, 'KeyedProperty', property=prop)
    for i,(frame,value) in enumerate(pairs):
        k = el(p, 'KeyFrameDouble', frame=frame, value=value, interpolationType='elastic' if elastic and i==0 else 'hold')
        if elastic and i==0:
            el(k, 'ElasticInterpolator', easingValue='easeOut', amplitude=1, period=0.4)
def shape(parent, name, points, color='FF141413'):
    s=el(parent,'Shape',name=name)
    p=el(s,'PointsPath',name='Path')
    for x,y in points:
        el(p,'StraightVertex',x=f'{x:.6f}',y=f'{y:.6f}')
    stroke=el(s,'Stroke',name='Stroke',thickness=18,cap='round',join='round')
    el(stroke,'SolidColor',colorValue=color)
    return s

main=el(root,'Artboard',id='0:1',name='Sync',width=240,height=240,styleId='0:2',viewModelId='0:40',defaultStateMachineId='0:3')
el(main,'LayoutComponentStyle',id='0:2',name='Style')
check=el(main,'Node',id='0:10',name='Check',x=120,y=120,scaleX=0,scaleY=0)
shape(check,'Accent check',[(-36,0),(-9.6,26.4),(36,-24)],'FFD97757')
nested=el(main,'NestedArtboard',id='0:11',name='Arrows',artboardId='0:20')
remap=el(nested,'NestedRemapAnimation',name='Phase',animationId='0:25')
bind(remap,43,202)
peek=el(nested,'NestedSimpleAnimation',name='Reversible peek',animationId='0:26',isPlaying='true',speed=-1)
bind(peek,44,199)
# An invisible rectangle provides a stable full-artboard pointer target.
hit=el(main,'Shape',id='0:12',name='Hover target',opacity=0)
el(hit,'Rectangle',width=240,height=240,x=120,y=120,name='Bounds')
el(el(hit,'Fill',name='Fill'),'SolidColor',colorValue='FF141413')
sm=el(main,'StateMachine',id='0:3',name='Sync controller')
for kind,value in [('enter',1),('exit',-1)]:
    listener=el(sm,'StateMachineListenerSingle',targetId='0:12',listenerTypeValue=kind,name=kind)
    action(listener,44,value)
layer=el(sm,'StateMachineLayer',name='Sync and completion')
el(layer,'AnyState',x=0,y=-200)
el(layer,'ExitState',x=200,y=-200)
transition(el(layer,'EntryState',x=0,y=0),100)
# Rest does not key phase. Host phase changes therefore remain usable after completion.
rest=el(layer,'AnimationState',id='0:100',x=200,y=0,animationId='0:50')
transition(rest,120,[(41,'true'),(45,'true')])
transition(rest,101,[(41,'true'),(45,'false')])
for i in range(12):
    state=el(layer,'AnimationState',id=f'0:{101+i}',x=400+(i%4)*200,y=(i//4)*180,animationId='0:51',reset='true')
    action(state,43,i/12)
    transition(state,120,[(45,'true')])
    transition(state,113,[(41,'false')],wait=True)
    transition(state,101+(i+1)%12,[(41,'true')],wait=True)
pop=el(layer,'AnimationState',id='0:113',x=400,y=600,animationId='0:52',reset='true')
transition(pop,121,[(45,'true')])
transition(pop,101,[(41,'true'),(45,'false')])
# Hold completed check, while phase can still scrub independently.
done=el(layer,'AnimationState',id='0:121',x=600,y=600,animationId='0:53')
transition(done,120,[(41,'true'),(45,'true')])
transition(done,101,[(41,'true'),(45,'false')])
red=el(layer,'AnimationState',id='0:120',x=800,y=600,animationId='0:50')
transition(red,121,[(41,'false')])
transition(red,101,[(41,'true'),(45,'false')])
for ident,name,duration,value in [(50,'Rest',1,0),(51,'Tick interval',6,0),(53,'Completed without overshoot',1,1)]:
    a=animation(main,ident,name,duration)
    for prop in ['scaleX','scaleY']:
        key(a,10,prop,[(0,value)])
a=animation(main,52,'Elastic completion',36)
for prop in ['scaleX','scaleY']:
    key(a,10,prop,[(0,0),(36,1)],True)

icon=el(root,'Artboard',id='0:20',name='Arrow component',width=240,height=240,isComponent='true',styleId='0:21',x=300)
el(icon,'LayoutComponentStyle',id='0:21',name='Style')
hover=el(icon,'Node',id='0:22',name='Peek pivot',x=120,y=120)
rot=el(hover,'Node',id='0:23',name='Rotation pivot')
# Two exact-radius cubic arcs, split into 75 degree spans.
for start in [-165,15]:
    a0=start*pi/180
    angles=[a0,a0+75*pi/180,a0+150*pi/180]
    s=el(rot,'Shape',name=f'Arc {start}')
    p=el(s,'PointsPath',name='Circular arc')
    handle=4/3*tan(75*pi/180/4)*72
    for j,a in enumerate(angles):
        el(p,'CubicDetachedVertex',x=f'{72*cos(a):.6f}',y=f'{72*sin(a):.6f}',inRotation=a-pi/2,inDistance=handle if j else 0,outRotation=a+pi/2,outDistance=handle if j<2 else 0)
    el(el(s,'Stroke',name='Ink stroke',thickness=18,cap='round',join='round'),'SolidColor',colorValue='FF141413')
    a=angles[-1]
    tip=(72*cos(a),72*sin(a))
    tangent=(-sin(a),cos(a)); normal=(cos(a),sin(a))
    # Each chevron arm is 2 grid units (24px), 45 degrees from the reverse tangent.
    pts=[(tip[0]-24/(2**.5)*(tangent[0]+normal[0]),tip[1]-24/(2**.5)*(tangent[1]+normal[1])),tip,(tip[0]-24/(2**.5)*(tangent[0]-normal[0]),tip[1]-24/(2**.5)*(tangent[1]-normal[1]))]
    shape(rot,'Arrowhead',pts)
a=animation(icon,25,'Twelve rotation poses',72)
key(a,23,'rotation',[(i*6,2*pi*i/12) for i in range(13)])
a=animation(icon,26,'Peek',24)
for prop in ['scaleX','scaleY']:
    key(a,22,prop,[(0,1),(24,1.1)])
    # Peek must interpolate; phase deliberately holds.
    a[-1][0][0].set('interpolationType','linear')
el(root,'ComponentAsset',name='Arrows',artboardId='0:20')
vm=el(root,'ViewModel',id='0:40',name='Sync inputs',defaultInstanceId='0:46')
for tag,ident,name in [('Boolean',41,'syncing'),('Number',43,'phase'),('Number',44,'peekSpeed'),('Boolean',45,'reducedMotion')]:
    el(vm,'ViewModelProperty'+tag,id=f'0:{ident}',name=name)
inst=el(vm,'ViewModelInstance',id='0:46',name='Default',exports='true')
for tag,ident,value in [('Boolean',41,'false'),('Number',43,0),('Number',44,-1),('Boolean',45,'false')]:
    el(inst,'ViewModelInstance'+tag,viewModelPropertyId=f'0:{ident}',propertyValue=value)
indent(root,space='  ')
Path(__file__).with_name('scene.rml').write_text(tostring(root,encoding='unicode')+'\n')

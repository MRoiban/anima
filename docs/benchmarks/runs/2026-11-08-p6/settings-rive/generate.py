from pathlib import Path
from xml.sax.saxutils import escape
ROOT = Path(__file__).parent
serial = 100
def uid():
    global serial
    serial += 1
    return f'0:{serial}'
fields = {}
def field(name, typ, val):
    fields[name] = (uid(), typ, val)
for n,t,v in [('volume','Number',40),('muted','Boolean',False),('selectedTab','String','General'),('email','Boolean',True),('push','Boolean',False),('sms','Boolean',False),('generalTitle','String','General'),('soundTitle','String','Sound'),('notificationsLabel','String','Notifications'),('emailLabel','String','Email'),('pushLabel','String','Push'),('smsLabel','String','SMS'),('volumeLabel','String','Volume'),('muteLabel','String','Mute'),('action','String',''),('volumeSpoken','String','Volume 40 %')]: field(n,t,v)
for n in ['generalSelected','soundSelected','generalHidden','soundHidden']: field(n,'Boolean',False)
for n in ['generalOpacity','soundOpacity','parentState','emailState','pushState','smsState','parentFill','parentBar','emailFill','pushFill','smsFill','volumeWidth','knobX','generalFill','soundFill']: field(n,'Number',0)
def bind(n,key): return f'<DataBindContext sourcePathIds="0:40-{fields[n][0]}" propertyKey="{key}"/>'
def fill(c): return f'<Fill><SolidColor colorValue="{c}"/></Fill>'
def rect(x,y,w,h,c,extra='',radius=0): return f'<Shape x="{x}" y="{y}">{extra}<Rectangle width="{w}" height="{h}" originX="0" originY="0" cornerRadiusTL="{radius}"/>{fill(c)}</Shape>'
def text(n,x,y):
    style=uid()
    return f'<Text x="{x}" y="{y}"><TextStylePaint fontAssetId="0:80" fontSize="16" id="{style}">{fill("FF141413")}</TextStylePaint><TextValueRun text="" styleId="{style}">{bind(n,268)}</TextValueRun></Text>'
def sem(role,label,state='',hidden=''):
    return f'<SemanticData role="{role}">{bind(label,983)}{state}{hidden}</SemanticData>'
listeners=[]
def listen(target,action,semantic='tap',keys=(),focus=None,pointer=True):
    if pointer and focus is None: focus = target
    triggers = '<ListenerInputType listenerTypeValue="click"/>' if pointer else ''
    if semantic: triggers += f'<ListenerInputTypeSemantic listenerTypeValue="semanticAction"><SemanticInput actionType="{semantic}"/></ListenerInputTypeSemantic>'
    for key in keys: triggers += f'<ListenerInputTypeKeyboard listenerTypeValue="keyboard"><KeyboardInput keyType="{key}" keyPhase="1"/></ListenerInputTypeKeyboard>'
    change=f'<ListenerViewModelChange><BindablePropertyString propertyValue="{action}"><DataBindContext sourcePathIds="0:40-{fields["action"][0]}" propertyKey="635" direction="true"/></BindablePropertyString></ListenerViewModelChange>'
    listeners.append(f'<StateMachineListener targetId="{target}">{triggers}{change}'+(f'<FocusActionTarget targetId="{focus}"/>' if focus else '')+'</StateMachineListener>')
general,sound,parent,email,push,sms,slider,mute=[uid() for _ in range(8)]
parts=[]
parts.append('<Node name="Settings tabs"><SemanticData role="tabList" label="Settings"/>')
for i,(node,label,selected,filln,x,action) in enumerate([(general,'generalTitle','generalSelected','generalFill',24,'general'),(sound,'soundTitle','soundSelected','soundFill',168,'sound')]):
    parts.append(f'<Node id="{node}" x="{x}" y="24"><FocusData/>'+sem('tab',label,bind(selected,997)))
    parts.append(rect(0,0,120,36,'FF141413'))
    parts.append(rect(2,2,116,32,'FFF0EEE6'))
    parts.append(rect(0,0,120,36,'FFD97757',bind(filln,18)))
    parts.append(text(label,10,8)+'</Node>')
    listen(node,action,keys=('enter','space'))
    listen(node,'sound',semantic=None,keys=('right',),focus=sound,pointer=False)
    listen(node,'general',semantic=None,keys=('left',),focus=general,pointer=False)
parts.append('</Node>')
parts.append('<Node name="General panel">'+bind('generalOpacity',18)+'<SemanticData role="group" label="General panel">'+bind('generalHidden',1004)+'</SemanticData>')
for node,label,state,filln,x,y,action in [(parent,'notificationsLabel','parentState','parentFill',24,96,'parent'),(email,'emailLabel','emailState','emailFill',48,144,'email'),(push,'pushLabel','pushState','pushFill',48,192,'push'),(sms,'smsLabel','smsState','smsFill',48,240,'sms')]:
    parts.append(f'<Node x="{x}" y="{y}" id="{node}">'+sem('checkbox',label,bind(state,998)))
    parts.append(rect(0,0,24,24,'FF141413')+rect(2,2,20,20,'FFF0EEE6')+rect(0,0,24,24,'FF141413',bind(filln,18)))
    if node==parent: parts.append(rect(4,10,16,4,'FF141413',bind('parentBar',18)))
    parts.append(text(label,36,3)+'</Node>')
    listen(node,action,keys=('space','enter'))
parts.append('</Node>')
parts.append('<Node name="Sound panel">'+bind('soundOpacity',18)+'<SemanticData role="group" label="Sound panel">'+bind('soundHidden',1004)+'</SemanticData>')
parts.append(f'<Node id="{slider}">'+sem('slider','volumeLabel',bind('volumeSpoken',984)) + rect(24,120,360,12,'FF141413'))
parts.append('<Shape x="24" y="120"><Rectangle width="144" height="12" originX="0" originY="0">'+bind('volumeWidth',20)+'</Rectangle>'+fill('FFD97757')+'</Shape>'+text('volumeLabel',24,90)+'</Node>')
listen(slider,'focusVolume',semantic=None,focus=slider)
listen(slider,'increase',semantic='increase',keys=('right','up'),pointer=False)
listen(slider,'decrease',semantic='decrease',keys=('left','down'),pointer=False)
parts.append(f'<Node id="{mute}" x="24" y="192">'+sem('switchControl','muteLabel',bind('muted',1000))+rect(0,0,72,36,'FF141413',radius=18))
parts.append('<Shape y="3.6">'+bind('knobX',13)+'<Rectangle width="28.8" height="28.8" originX="0" originY="0" cornerRadiusTL="14.4"/>'+fill('FFD97757')+'</Shape>'+text('muteLabel',88,9)+'</Node></Node>')
listen(mute,'mute',keys=('space','enter'))
vm='<ViewModel name="Settings" id="0:40" defaultInstanceId="0:41">'
for n,(id,t,v) in fields.items(): vm+=f'<ViewModelProperty{t} name="{n}" id="{id}"/>'
vm+='<ViewModelInstance name="Default" id="0:41" exports="true">'
for n,(id,t,v) in fields.items():
    value=str(v).lower() if isinstance(v,bool) else str(v)
    vm+=f'<ViewModelInstance{t} viewModelPropertyId="{id}" propertyValue="{escape(value)}"/>'
vm+='</ViewModelInstance></ViewModel>'
rml='<Rive version="1" kind="fragment"><Artboard width="480" height="360" name="Settings" id="0:2" styleId="0:5" viewModelId="0:40" viewModelInstanceId="0:41" defaultStateMachineId="0:7"><LayoutComponentStyle id="0:5"/>'+fill('FFF0EEE6')+''.join(parts)+'<ScriptedLayout scriptAssetId="0:81" name="Settings logic"/><StateMachine name="Settings machine" id="0:7">'+''.join(listeners)+'<StateMachineLayer><EntryState><StateTransition stateToId="0:12"/></EntryState><AnimationState animationId="0:6" id="0:12"><FocusActionTarget targetId="'+general+'"/></AnimationState></StateMachineLayer></StateMachine><LinearAnimation duration="60" id="0:6" name="Idle"/></Artboard>'+vm+'<FontAsset file="anima-test.ttf" name="Test shapes" id="0:80"/><ScriptAsset file="settings.luau" name="settings" id="0:81"/></Rive>'
import xml.dom.minidom
(ROOT/'scene.rml').write_text(xml.dom.minidom.parseString(rml).toprettyxml(indent='  '))
# RML siblings are front to back; the helpers above describe back to front.
from xml.dom.minidom import parseString
doc = parseString(rml)
for node in doc.getElementsByTagName('Node'):
    drawables = [c for c in node.childNodes if c.nodeType == c.ELEMENT_NODE and c.tagName in ('Node', 'Shape', 'Text')]
    for child in drawables:
        node.removeChild(child)
    for child in reversed(drawables):
        node.appendChild(child)
for state in doc.getElementsByTagName('AnimationState'):
    state.setAttribute('x', '200')
    state.setAttribute('y', '0')
(ROOT/'scene.rml').write_text(doc.toprettyxml(indent='  '))
# Solo removes the inactive panel from rendering, hit testing and semantics.
artboard = doc.getElementsByTagName('Artboard')[0]
panels = [n for n in artboard.childNodes if n.nodeType == n.ELEMENT_NODE and n.tagName == 'Node' and n.getAttribute('name').endswith(' panel')]
solo_id, general_panel, sound_panel = uid(), uid(), uid()
solo = doc.createElement('Solo')
solo.setAttribute('id', solo_id)
solo.setAttribute('name', 'Active panel')
solo.setAttribute('activeComponentId', general_panel)
artboard.appendChild(solo)
for panel, id in zip(panels, [general_panel, sound_panel]):
    panel.setAttribute('id', id)
    artboard.removeChild(panel)
    solo.appendChild(panel)
state_g, state_s, anim_g, anim_s = uid(), uid(), uid(), uid()
def transition(to, value):
    return f'<StateTransition stateToId="{to}" duration="0"><TransitionViewModelCondition><TransitionPropertyViewModelComparator><BindablePropertyString>{bind("selectedTab",635)}</BindablePropertyString></TransitionPropertyViewModelComparator><TransitionValueStringComparator value="{value}"/></TransitionViewModelCondition></StateTransition>'
layer=f'<StateMachineLayer name="Panels"><EntryState><StateTransition stateToId="{state_g}"/></EntryState><AnimationState x="200" animationId="{anim_g}" id="{state_g}">{transition(state_s,"Sound")}</AnimationState><AnimationState x="400" animationId="{anim_s}" id="{state_s}">{transition(state_g,"General")}</AnimationState></StateMachineLayer>'
doc.getElementsByTagName('StateMachine')[0].appendChild(parseString(layer).documentElement)
for aid,pid,name in [(anim_g,general_panel,'General'),(anim_s,sound_panel,'Sound')]:
    animation=f'<LinearAnimation name="{name} panel" id="{aid}" duration="1"><KeyedObject objectId="{solo_id}"><KeyedProperty propertyKey="296"><KeyFrameId value="{pid}" frame="0" interpolationType="hold"/></KeyedProperty></KeyedObject></LinearAnimation>'
    artboard.appendChild(parseString(animation).documentElement)
(ROOT/'scene.rml').write_text(doc.toprettyxml(indent='  '))

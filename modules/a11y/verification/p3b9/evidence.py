"""[P3b-9] Independent semantic expectations, built from the documented role/state rules.
Does not execute Anima. Re-run from the repository root, then build-animl.ts.
"""
import json
from pathlib import Path
root = Path('spec/conformance')
roles = 'button checkbox switch radio radio-group slider tab tab-list link list list-item group dialog alert-dialog heading text img none'.split()
focusable = 'button checkbox switch radio slider tab link list-item'.split()

def node(role, id='item', states=None, actions=None, **props):
    states = dict(states or {})
    if role in focusable:
        states['focused'] = False
    return dict(id=id, role=role, states=states, bounds=[1,2,3,4], actions=actions if actions is not None else (['increase','decrease','focus'] if role=='slider' else ['focus'] if role in focusable else []), children=[], **props)

def case(name, body, trees, script='advance 0\nsnapshot --semantics\n', requires='a11y focus', inputs=''):
    path = root / ('a11y-'+name)
    path.mkdir(exist_ok=True)
    (path/'case.animl').write_text(f'<anima version="0.1" name="{name}" grid="20" requires="{requires}">\n{inputs}\n{body}\n</anima>\n')
    (path/'script.txt').write_text(script)
    (path/'expected.jsonl').write_text(''.join(json.dumps(dict(time=0,values={},states={},events=[],settled=True,semantics=t),separators=(',',':'))+'\n' for t in trees))

def group(role, extra='', id='item'):
    return f'<group id="{id}"><a11y role="{role}" bounds="1 2 3 4" {extra}/></group>'

for role in roles:
    extra='label="Example"'
    props=dict(label='Example')
    inputs=''
    if role=='slider':
        extra+=' value="amount"'; props.update(value=0,min=0,max=100,step=1); inputs='<number name="amount"/>'
    if role=='heading': extra+=' level="2"'; props['level']=2
    if role=='link': extra+=' href="/help"'; props['href']='/help'
    body=group(role,extra)
    trees=[[node(role,**props)]]
    if role=='none':
        body='<group id="wrapper"><a11y role="none"/>'+group('text','label="Lifted"')+'</group>'
        trees=[[node('text',label='Lifted')]]
    case('role-'+role,body,trees,inputs=inputs)

# Each state is toggled by a separate semantic button, so readonly/disabled/hidden do not
# rely on editing the control that is being tested. Checked-mixed uses its explicit bool.
state_roles={'checked':'checkbox','checked-mixed':'checkbox','pressed':'button','selected':'tab','expanded':'group','disabled':'button','hidden':'text','required':'slider','readonly':'slider','modal':'dialog'}
for state,role in state_roles.items():
    prop={'value':0,'min':0,'max':100,'step':1} if role=='slider' else {}
    extra=f'{state}="flag"'+(' value="amount"' if role=='slider' else '')
    control=node('button',id='control',actions=['tap','focus'])
    a=node(role,states={} if state in ['hidden','checked-mixed'] else {state:False},**prop)
    b=node(role,states={} if state in ['hidden','checked-mixed'] else {state:True},**prop)
    if state=='checked-mixed': b['states']['checked']='mixed'
    if state in ['checked','pressed','selected']: a['actions']=b['actions']=['tap','focus']
    if state=='readonly': b['actions']=['focus']
    if state=='disabled': b['states'].pop('focused');b['actions']=[]
    before=[control,a]; after=[control,b]
    if state=='hidden': after=[control]
    if state=='modal': after=[b]
    case('state-'+state,group('button','activate="flag"',id='control')+group(role,extra),[before,after],
        'advance 0\nsnapshot --semantics\nsemantic control tap\nsnapshot --semantics\n',inputs='<bool name="flag"/>'+('<number name="amount"/>' if role=='slider' else ''))

# Property changes from two independent sources. Numeric levels use constrained number inputs.
for data in [True]:
    fields={'label':'title','hint':'help','value':'text','level':'depth'}
    prefix='$' if data else ''
    body=group('heading',' '.join(f'{k}="&quot;{prefix}{v}&quot;"' if k=='level' else f'{k}="{prefix}{v}"' for k,v in fields.items()))
    initial=dict(label='Before',hint='Help',value='Value',level=2)
    final=dict(label='After',hint='More',value='Changed',level=4)
    declarations='<string name="title" default="Before"/><string name="help" default="Help"/><string name="text" default="Value"/><number name="depth" default="2" min="1" max="6"/>'
    if data: declarations='<model name="M">'+declarations+'</model><instance name="main" model="M" default="true"/>'
    script='advance 0\nsnapshot --semantics\n'+''.join(f'set {prefix}{v} {json.dumps(final[k])}\n' for k,v in fields.items())+'advance 0\nsnapshot --semantics\n'
    case('properties-'+('data' if data else 'inputs'),body,[[node('heading',**initial)],[node('heading',**final)]],script,requires='a11y focus'+(' data' if data else ''),inputs=declarations)

# Role x every legal role-specific state, explicit false and true: traits do not disappear
# when false. Global states have dedicated cases above to avoid modal/hidden pruning here.
allowed={'checked':'checkbox switch radio','pressed':'button','selected':'tab list-item radio','expanded':'button link group list-item','required':'checkbox switch radio radio-group slider','readonly':'checkbox switch slider'}
body='';before=[];after=[]
for state,valid in allowed.items():
    for role in valid.split():
        id=role+'-'+state
        body+=group(role,f'{state}="flag"'+(' value="amount"' if role=='slider' else ''),id)
        props=dict(value=0,min=0,max=100,step=1) if role=='slider' else {}
        before.append(node(role,id,states={state:False},**props))
        after.append(node(role,id,states={state:True},**props))
        if state in ['checked','pressed','selected']:before[-1]['actions']=after[-1]['actions']=['tap','focus']
        if state=='readonly':after[-1]['actions']=['focus']
case('traits-matrix',group('button','activate="flag"',id='control')+body,[[node('button','control',actions=['tap','focus'])]+before,[node('button','control',actions=['tap','focus'])]+after], 'advance 0\nsnapshot --semantics\nsemantic control tap\nsnapshot --semantics\n',inputs='<bool name="flag"/><number name="amount"/>')

# Semantic action clamping, focus, and readonly no-op are independently expected.
a=node('slider',value=99,min=0,max=100,step=5)
b=node('slider',value=100,min=0,max=100,step=5)
c=node('slider',value=95,min=0,max=100,step=5)
d=node('slider',value=95,min=0,max=100,step=5);d['states']['focused']=True
case('actions-range',group('slider','value="amount" step="5"'),[[a],[b],[b],[c],[d]],'advance 0\nsnapshot --semantics\nsemantic item increase\nsnapshot --semantics\nsemantic item increase\nsnapshot --semantics\nsemantic item decrease\nsnapshot --semantics\nsemantic item focus\nsnapshot --semantics\n',inputs='<number name="amount" default="99"/>')

# Ancestor conditions, traversal restrictions and retargeting share the semantic tree policy.
parent=node('group',id='parent',states={'focused':False},actions=['focus'])
child=node('button',id='child');parent['children']=[child]
other=node('button',id='other',states={'disabled':True},actions=[]);other['states'].pop('focused')
last=node('button',id='last')
import copy
focused=copy.deepcopy([parent,other,last]);focused[0]['states']['focused']=True;focused[0]['children'][0]['states']['focused']=True
retarget=copy.deepcopy([parent,other,last]);retarget[0]['states']['focused']=True;retarget[0]['children']=[]
traversed=copy.deepcopy(retarget);traversed[0]['states']['focused']=False;traversed[2]['states']['focused']=True
case('focus-policy','<group id="parent"><focus/>'+ '<a11y role="group" bounds="1 2 3 4"/>'+group('button','hidden="hide"',id='child')+'</group>'+group('button','disabled="true"',id='other')+group('button',id='last'),[[parent,other,last],focused,retarget,traversed], 'advance 0\nsnapshot --semantics\nsemantic child focus\nsnapshot --semantics\nset hide true\nadvance 0\nsnapshot --semantics\nfocus traverse next\nadvance 0\nsnapshot --semantics\n',inputs='<bool name="hide"/>')
# Bindable heading level: number input grammar stays unchanged.
case('property-heading-level',group('heading','level="&quot;depth&quot;"'),[[node('heading',level=2)],[node('heading',level=4)]], 'advance 0\nsnapshot --semantics\nset depth 4\nadvance 0\nsnapshot --semantics\n',requires='a11y',inputs='<number name="depth" default="2" min="1" max="6"/>')
# Live politeness remains platform metadata; a label change must preserve both modes.
case('state-live-region',group('text','label="$title" live="polite"',id='polite')+group('text','label="$title" live="assertive"',id='assertive'),[[node('text','polite',states={'live':'polite'},label='Before'),node('text','assertive',states={'live':'assertive'},label='Before')],[node('text','polite',states={'live':'polite'},label='After'),node('text','assertive',states={'live':'assertive'},label='After')]],'advance 0\nsnapshot --semantics\nset $title "After"\nadvance 0\nsnapshot --semantics\n',requires='a11y data',inputs='<model name="M"><string name="title" default="Before"/></model><instance name="main" model="M" default="true"/>')
# A real machine transition must see focused ancestry, not just the exact leaf id.
f=copy.deepcopy([parent]);g=copy.deepcopy(f);g[0]['states']['focused']=True;g[0]['children'][0]['states']['focused']=True
case('focus-condition','<group id="parent"><focus/><a11y role="group" bounds="1 2 3 4"/>'+group('button',id='child')+'</group><layer name="l" initial="idle"><state name="idle"><on when="@after(0)" to="focused" guard="{&quot;left&quot;:{&quot;focus&quot;:&quot;parent&quot;},&quot;right&quot;:true,&quot;op&quot;:&quot;==&quot;}"/></state><state name="focused"><on when="@after(0)" to="idle" guard="{&quot;left&quot;:{&quot;focus&quot;:&quot;parent&quot;},&quot;right&quot;:false,&quot;op&quot;:&quot;==&quot;}"/></state></layer>',[f,g,f], 'advance 0\nsnapshot --semantics\nsemantic child focus\nsnapshot --semantics\nfocus clear\nsnapshot --semantics\n',requires='a11y focus input machine')
p=root/'a11y-focus-condition'/'expected.jsonl'
snapshots=[json.loads(line) for line in p.read_text().splitlines()]
for snap,state in zip(snapshots,['idle','focused','idle']):snap['states']={'l':state}
p.write_text(''.join(json.dumps(s,separators=(',',':'))+'\n' for s in snapshots))
# Active scaffolds are replaced only once their independent probes are specified.
for name in ['a11y-focus-condition','a11y-property-heading-level']:
    (root/name/'todo.json').unlink(missing_ok=True)

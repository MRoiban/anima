#!/usr/bin/env python3
"""Generate toolbar RML from the three permitted Glyphy SVG inputs.
All press logic lives in Button; all badge logic lives in Badge.
No runtime script or external asset is required.
"""
import base64
import struct
import math
import re
from pathlib import Path
import xml.etree.ElementTree as X

HERE = Path(__file__).resolve().parent
ROOT = next(p for p in HERE.parents if (p / 'fixtures/glyphs').is_dir())
r = X.Element('Rive', version='1', kind='fragment')
serial = 1000

def add(parent, tag, **attrs):
    return X.SubElement(parent, tag, {k: str(v).lower() if isinstance(v, bool) else str(v) for k, v in attrs.items()})

def uid():
    global serial
    serial += 1
    return f'0:{serial}'

def bind(parent, path, key, **extra):
    return add(parent, 'DataBindContext', sourcePathIds=path, propertyKey=key, **extra)

def art(name, aid, width, height, vm=None, sm=None, component=False, x=0):
    style = uid()
    a = add(r, 'Artboard', name=name, id=aid, width=width, height=height, x=x,
            styleId=style, isComponent=component, clip=False)
    add(a, 'LayoutComponentStyle', id=style, name='Fixed artboard')
    if vm:
        a.set('viewModelId', vm)
    if sm:
        a.set('defaultStateMachineId', sm)
    if component:
        add(r, 'ComponentAsset', name=name, artboardId=aid)
    return a

def model(name, mid, props, defaults):
    iid = uid()
    vm = add(r, 'ViewModel', name=name, id=mid, defaultInstanceId=iid)
    for typ, pname, pid in props:
        add(vm, 'ViewModelProperty' + typ, name=pname, id=pid, componentProps=1)
    inst = add(vm, 'ViewModelInstance', name='Default', id=iid, exports=True)
    values(inst, defaults)
    return vm

def values(inst, defaults):
    for typ, pid, val in defaults:
        add(inst, 'ViewModelInstance' + typ, viewModelPropertyId=pid, propertyValue=val)

def machine(a, sid):
    return add(a, 'StateMachine', name='Interaction', id=sid)

def layer(sm, name, entry):
    l = add(sm, 'StateMachineLayer', name=name)
    add(l, 'AnyState', x=0, y=-120)
    add(l, 'ExitState', x=500, y=-120)
    e = add(l, 'EntryState', x=0, y=0)
    if entry:
        add(e, 'StateTransition', stateToId=entry)
    return l

def condition(t, path, typ, val, op='equal', other=None):
    c = add(t, 'TransitionViewModelCondition', opValue=op)
    left = add(c, 'TransitionPropertyViewModelComparator')
    key = 634 if typ == 'Boolean' else 636
    bind(add(left, 'BindableProperty' + typ), path, key)
    if other:
        right = add(c, 'TransitionPropertyViewModelComparator')
        bind(add(right, 'BindableProperty' + typ), other, key)
    else:
        add(c, 'TransitionValue' + typ + 'Comparator', value=val)

def write(parent, path, typ, val, read=None):
    action = add(parent, 'ListenerViewModelChange')
    key = 634 if typ == 'Boolean' else 636
    p = add(action, 'BindableProperty' + typ, propertyValue=val)
    if read:
        action.set('fromViewModelProperty', 'true')
        rid = uid()
        action.set('fromDataBindId', rid)
        bind(p, read, key, id=rid)
    bind(p, path, key, direction=True)

def anim(a, name, aid, target, props, duration=1):
    an = add(a, 'LinearAnimation', name=name, id=aid, duration=duration, fps=120, loopValue='oneShot')
    obj = add(an, 'KeyedObject', objectId=target)
    for prop, keys in props.items():
        kp = add(obj, 'KeyedProperty', property=prop)
        for frame, value in keys:
            add(kp, 'KeyFrameDouble', frame=frame, value=value, interpolationType='linear')

def ellipse(parent, name, x, y, size, color):
    s = add(parent, 'Shape', name=name, x=x, y=y)
    add(s, 'Ellipse', width=size, height=size, originX=.5, originY=.5)
    add(add(s, 'Fill'), 'SolidColor', colorValue=color)
    return s

# Exact absolute M/L/C/Z SVG geometry, preserving cubic handles and compound fills.
def glyph(a, name):
    d = X.parse(ROOT / f'fixtures/glyphs/{name}.svg').getroot()[0].get('d')
    tokens = re.findall(r'[MLCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?', d)
    shape = add(a, 'Shape', name=name)
    contours, segs, i, pen, start = [], [], 0, None, None
    while i < len(tokens):
        cmd = tokens[i]; i += 1
        if cmd == 'Z':
            if math.dist(pen, start) > 1e-9:
                segs.append((pen, start, None, None))
            contours.append(segs); segs = []
            continue
        n = 6 if cmd == 'C' else 2
        nums = list(map(float, tokens[i:i+n])); i += n
        end = tuple(nums[-2:])
        if cmd == 'M':
            start = end
        else:
            segs.append((pen, end, tuple(nums[:2]) if cmd == 'C' else None,
                         tuple(nums[2:4]) if cmd == 'C' else None))
        pen = end
    for segs in contours:
        p = add(shape, 'PointsPath', isClosed=True)
        for j, (pos, end, hout, _) in enumerate(segs):
            hin = segs[j-1][3]
            attrs = dict(x=round(pos[0]*12, 6), y=round(pos[1]*12, 6))
            if hin or hout:
                for prefix, h in [('in', hin), ('out', hout)]:
                    dx, dy = (h[0]-pos[0], h[1]-pos[1]) if h else (0, 0)
                    attrs[prefix+'Rotation'] = round(math.atan2(dy, dx), 8)
                    attrs[prefix+'Distance'] = round(math.hypot(dx, dy)*12, 6)
                add(p, 'CubicDetachedVertex', **attrs)
            else:
                add(p, 'StraightVertex', **attrs)
    add(add(shape, 'Fill', fillRule='evenOdd'), 'SolidColor', colorValue='FF141413')

host = art('Toolbar', '0:1', 864, 288, '0:10', '0:2')
hsm = machine(host, '0:2'); layer(hsm, 'Data', None)
model('Toolbar', '0:10', [('Number','unread','0:11'),('Number','trash','0:12')],
      [('Number','0:11',3),('Number','0:12',0)])
for index, (name, gaid) in enumerate([('bell','0:100'),('folder','0:101'),('trash','0:102')]):
    place = add(host, 'NestedArtboard', name=name, id=f'0:{20+index}', artboardId='0:30',
                isStateful=True, x=(2+24*index)*12, y=24)
    add(place, 'NestedStateMachine', animationId='0:31', name='Press machine')
    inst = add(place, 'ViewModelInstance', viewModelId='0:40', exports=True, id=uid(), name=name+' data')
    values(inst, [('Artboard','0:43',gaid),('Boolean','0:41',False),('Boolean','0:42',False)])
    value = add(inst, 'ViewModelInstanceNumber', viewModelPropertyId='0:44', propertyValue=3 if index == 0 else 0)
    if index != 1:
        bind(value, '0:10-'+('0:11' if index == 0 else '0:12'), 575, twoWay=True)
    ga = art(name.title()+' glyph', gaid, 240, 240, component=True, x=1300+index*300)
    glyph(ga, name)

background = add(host, 'Shape', name='White background')
add(background, 'Rectangle', width=864, height=288, originX=0, originY=0)
add(add(background, 'Fill'), 'SolidColor', colorValue='FFFFFFFF')

# One generic button. Both pointer state and scale timelines are authored once.
button = art('Button', '0:30', 240, 240, '0:40', '0:31', True, 950)
model('Button', '0:40', [('Boolean','hover','0:41'),('Boolean','down','0:42'),
                       ('Artboard','glyph','0:43'),('Number','count','0:44')],
      [('Boolean','0:41',False),('Boolean','0:42',False),('Artboard','0:43','0:100'),('Number','0:44',0)])
pivot = add(button, 'Node', name='Press pivot', id='0:32', x=120, y=120)
content = add(pivot, 'Node', x=-120, y=-120, name='Content')
badge = add(content, 'NestedArtboard', name='Badge', artboardId='0:60', isStateful=True, x=228, y=48)
add(badge, 'NestedStateMachine', animationId='0:61', name='Badge machine')
binst = add(badge, 'ViewModelInstance', viewModelId='0:70', exports=True, id=uid(), name='Badge data')
cv = add(binst, 'ViewModelInstanceNumber', viewModelPropertyId='0:71', propertyValue=0)
bind(cv, '0:40-0:44', 575)
add(binst, 'ViewModelInstanceNumber', viewModelPropertyId='0:72', propertyValue=0)
icon = add(content, 'NestedArtboard', name='Glyph', artboardId='0:100')
bind(icon, '0:40-0:43', 197)
# A transparent full-size shape supplies the whole 20-unit hit region.
hit = add(content, 'Shape', name='Hit region', id='0:33')
add(hit, 'Rectangle', width=240, height=240, originX=0, originY=0)
add(add(hit, 'Fill'), 'SolidColor', colorValue='FFFFFFFF')
sm = machine(button, '0:31')
for gesture, changes in [('enter',[('0:41',True)]),('exit',[('0:41',False),('0:42',False)]),
                         ('down',[('0:42',True)]),('up',[('0:42',False)])]:
    listener = add(sm, 'StateMachineListenerSingle', targetId='0:33', listenerTypeValue=gesture, name=gesture)
    for pid, value in changes:
        write(listener, '0:40-'+pid, 'Boolean', value)
click = add(sm, 'StateMachineListenerSingle', targetId='0:33', listenerTypeValue='click', name='Clear count')
write(click, '0:40-0:44', 'Number', 0)
l = layer(sm, 'Shared press', '0:51')
for n, (sid, aid, scale) in enumerate([('0:51','0:54',1),('0:52','0:55',1.06),('0:53','0:56',.92)]):
    state = add(l, 'AnimationState', id=sid, animationId=aid, x=180+n*180, y=n*90)
    destinations = [('0:53',80,[('0:42',True)])] if n != 2 else []
    if n != 1:
        destinations.append(('0:52',120,[('0:42',False),('0:41',True)]))
    if n != 0:
        destinations.append(('0:51',120,[('0:42',False),('0:41',False)]))
    for target, duration, tests in destinations:
        t = add(state, 'StateTransition', stateToId=target, duration=duration, enableEarlyExit=True)
        for pid, value in tests:
            condition(t, '0:40-'+pid, 'Boolean', value)
    anim(button, ['Rest','Hover','Down'][n], aid, '0:32', {'scaleX':[(0,scale)],'scaleY':[(0,scale)]})

# One badge with its own count and previous-count memory. Increases pop;
# decreases only synchronise memory. Numeric glyphs are original embedded outlines.
ba = art('Badge', '0:60', 84, 84, '0:70', '0:61', True, 2300)
model('Badge', '0:70', [('Number','count','0:71'),('Number','previous','0:72')],
      [('Number','0:71',0),('Number','0:72',0)])
visible = add(ba, 'Node', name='Visible only above zero')
bind(visible, '0:70-0:71',18,converterId='0:80')
pop = add(visible, 'Node', name='Pop pivot', id='0:62')
# A tiny original numeric font, embedded as bytes; no external font source.
def numeric_font():
    pack = lambda fmt, *v: struct.pack('>'+fmt, *v)
    patterns = ['abcedf', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd',
                'afgecd', 'abc', 'abcdefg', 'abfgcd']
    boxes = dict(a=(70,700,530,780), b=(490,410,570,740),
                 c=(490,60,570,390), d=(70,20,530,100),
                 e=(30,60,110,390), f=(30,410,110,740), g=(70,360,530,440))
    glyf = b''; offsets = [0]
    for pattern in [''] + patterns:
        pts = []; ends = []
        for key in pattern:
            x0,y0,x1,y1 = boxes[key]
            pts += [(x0,y0),(x0,y1),(x1,y1),(x1,y0)]
            ends.append(len(pts)-1)
        data = pack('hhhhh', len(ends), 0, 0, 600, 800)
        data += b''.join(pack('H',v) for v in ends) + pack('H',0)
        data += bytes([1]*len(pts))
        for axis in (0,1):
            previous = 0
            for point in pts:
                data += pack('h',point[axis]-previous); previous=point[axis]
        data += bytes((-len(data))%4)
        glyf += data; offsets.append(len(glyf))
    tables = {}
    tables['glyf'] = glyf
    tables['loca'] = b''.join(pack('I',v) for v in offsets)
    tables['head'] = pack('IIIIHHQQhhhhHHhhh',0x10000,0x10000,0,0x5f0f3cf5,3,1000,
                          0,0,0,0,600,800,0,8,2,1,0)
    tables['hhea'] = pack('IhhhHhhhhhhhhhhhH',0x10000,800,-200,0,600,0,0,600,
                          1,0,0,0,0,0,0,0,11)
    tables['hmtx'] = pack('Hh',600,0)*11
    tables['maxp'] = pack('IH'+'H'*13,0x10000,11,28,7,0,0,2,0,0,0,0,0,0,0,0)
    cmap = pack('HHHHHHH',4,32,0,4,4,1,0)+pack('HHHHHHHHH',57,65535,0,48,65535,65489,1,0,0)
    tables['cmap'] = pack('HHHHI',0,1,3,1,12)+cmap
    names = [(1,'Benchmark Digits'),(2,'Regular'),(4,'Benchmark Digits Regular'),(6,'BenchmarkDigits-Regular')]
    body=b''; records=b''
    for key,value in names:
        encoded=value.encode('utf-16-be')
        records+=pack('HHHHHH',3,1,0x409,key,len(encoded),len(body)); body+=encoded
    tables['name']=pack('HHH',0,len(names),6+12*len(names))+records+body
    tables['post']=pack('IIhhIIIII',0x30000,0,0,0,1,0,0,0,0)
    checksum=lambda data: sum(struct.unpack('>'+'I'*((len(data)+3)//4),data+bytes((-len(data))%4)))&0xffffffff
    n=len(tables); search=2**int(math.log2(n)); off=12+16*n
    header=pack('IHHHH',0x10000,n,search*16,int(math.log2(n)),n*16-search*16)
    directory=b''; content=b''; head_offset=0
    for tag,data in sorted(tables.items()):
        directory+=tag.encode()+pack('III',checksum(data),off,len(data))
        if tag=='head': head_offset=off
        padded=data+bytes((-len(data))%4); content+=padded; off+=len(padded)
    font=bytearray(header+directory+content)
    font[head_offset+8:head_offset+12]=pack('I',(0xb1b0afba-checksum(font))&0xffffffff)
    return base64.b64encode(font).decode()

font = add(r,'FontAsset',id='0:90',name='Benchmark Digits')
add(font,'FileAssetContents',bytes=numeric_font())
text=add(pop,'Text',name='Count number',originX=.5,originY=.5,sizingValue='autoWidth')
style=add(text,'TextStylePaint',id='0:91',name='Digits',fontAssetId='0:90',fontSize=48,
          familyName='Benchmark Digits',styleName='Regular')
add(add(style,'Fill'),'SolidColor',colorValue='FFFFFFFF')
run=add(text,'TextValueRun',styleId='0:91',text='3',name='Count')
bind(run,'0:70-0:71',268,converterId='0:92')
add(r,'DataConverterToString',id='0:92',name='Integer label',decimals=0,round=True)
ellipse(pop, 'Accent disc',0,0,84,'FFD97757')
add(r,'DataConverterRangeMapper',id='0:80',name='Visible above zero',
    minInput=0,maxInput=1,minOutput=0,maxOutput=1,clampLower=True,clampUpper=True)
sm = machine(ba,'0:61'); l = layer(sm,'Count increases','0:63')
idle = add(l,'AnimationState',id='0:63',animationId='0:66',x=180,y=0)
ps = add(l,'AnimationState',id='0:64',animationId='0:67',reset=True,x=380,y=100)
sync = add(l,'AnimationState',id='0:65',animationId='0:66',x=380,y=-100)
for state in (idle, ps):
    t = add(state,'StateTransition',stateToId='0:64',duration=0)
    condition(t,'0:70-0:71','Number',0,'greaterThan',other='0:70-0:72')
    t = add(state,'StateTransition',stateToId='0:65',duration=0)
    condition(t,'0:70-0:71','Number',0,'lessThan',other='0:70-0:72')
for state in (ps, sync):
    write(state,'0:70-0:72','Number',0,read='0:70-0:71')
    add(state,'StateTransition',stateToId='0:63',duration=0,
        enableExitTime=True,exitTimeIsPercetange=True,exitTime=100)
anim(ba,'Still','0:66','0:62',{'scaleX':[(0,1)],'scaleY':[(0,1)]})
anim(ba,'Pop','0:67','0:62',{'scaleX':[(0,1),(15,1.25),(30,1)],
                          'scaleY':[(0,1),(15,1.25),(30,1)]},30)
X.indent(r, space='  ')
(HERE/'scene.rml').write_text(X.tostring(r, encoding='unicode')+'\n')

#!/usr/bin/env python3
"""Author paired oracle scenes. No Rive capture or account operations are performed here."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INK = '#4263eb'

def solid(color):
    c = color.lstrip('#')
    return f'<SolidColor colorValue="{c[6:] if len(c) == 8 else "FF"}{c[:6]}"/>'

def fill(color=INK):
    return f'<Fill>{solid(color)}</Fill>'

def rectangle(x=3, y=3, w=14, h=14):
    return f'<Rectangle x="{x*12}" y="{y*12}" width="{w*12}" height="{h*12}" originX="0" originY="0"/>'

def shape(geom, paint=None, extra=''):
    return f'<Shape {extra}>{geom}{fill() if paint is None else paint}</Shape>'

def point(x,y,ident=''):
    return f'<StraightVertex x="{x*12}" y="{y*12}" {ident}/>'

def path(points,closed=True):
    return f'<PointsPath isClosed="{str(closed).lower()}">'+''.join(point(*p) for p in points)+'</PointsPath>'

def rounded(points,radii):
    # Quadratic cutbacks from the public Anima spec, encoded as exact cubic handles.
    entries=[]
    for i,p in enumerate(points):
        prev,nxt=points[i-1],points[(i+1)%len(points)]
        def cut(q):
            d=math.dist(p,q); t=min(radii[i],d/2)/d
            return (p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t)
        a,b=cut(prev),cut(nxt)
        entries.extend([(a,None,(a[0]+2/3*(p[0]-a[0]),a[1]+2/3*(p[1]-a[1]))),
                        (b,(b[0]+2/3*(p[0]-b[0]),b[1]+2/3*(p[1]-b[1])),None)])
    out=[]
    for p,hin,hout in entries:
        def handle(h):
            if h is None: return (0,0)
            return (math.atan2(h[1]-p[1],h[0]-p[0]),math.dist(h,p)*12)
        ir,di=handle(hin); ort,do=handle(hout)
        out.append(f'<CubicDetachedVertex x="{p[0]*12}" y="{p[1]*12}" inRotation="{ir}" inDistance="{di}" outRotation="{ort}" outDistance="{do}"/>')
    return '<PointsPath isClosed="true">'+''.join(out)+'</PointsPath>'

def animation(obj,prop,a,b):
    return f'<KeyedObject objectId="{obj}"><KeyedProperty property="{prop}"><KeyFrameDouble frame="0" value="{a}" interpolationType="linear"/><KeyFrameDouble frame="60" value="{b}"/></KeyedProperty></KeyedObject>'

def save(name,ani,rive,tracks='',keys='',requires='paint composite'):
    d=ROOT/name; (d/'rive/frames').mkdir(parents=True,exist_ok=True)
    (d/'anima').mkdir(exist_ok=True)
    times=[0,.5,1] if tracks else [0]
    if tracks:
        ani+=f'<timeline name="t" duration="1">{tracks}</timeline><layer name="l" initial="s"><state name="s" play="t"/></layer>'
        rive+='<LinearAnimation name="t" id="0:100" fps="60" duration="60" loopValue="oneShot">'+keys+'</LinearAnimation><StateMachine name="s" id="0:101"><StateMachineLayer name="l"><EntryState><StateTransition stateToId="0:102"/></EntryState><AnimationState id="0:102" animationId="0:100"/></StateMachineLayer></StateMachine>'
    (d/'case.animl').write_text(f'<anima version="0.1" name="{name}" grid="20" requires="{requires}">{ani}</anima>\n')
    default=' defaultStateMachineId="0:101"' if tracks else ''
    (d/'rive/scene.rml').write_text(f'<Rive version="1" kind="fragment"><Artboard name="Oracle" id="0:1" width="240" height="240" styleId="0:2"{default}><LayoutComponentStyle id="0:2"/><Fill>{solid("#ffffff")}</Fill>{rive}</Artboard></Rive>\n')
    (d/'rive/rive.yaml').write_text(f'name: oracle-{name}\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
    commands=['screenshot frames/0.png']
    if tracks: commands+=['advance 500ms','screenshot frames/0.5.png','advance 500ms','screenshot frames/1.png']
    (d/'rive/commands.txt').write_text('\n'.join(commands)+'\n')
    return {'name':name,'times':times}

cases=[]
for kind in ['linear','radial','animated-stop']:
    radial=kind=='radial'; tag='RadialGradient' if radial else 'LinearGradient'
    coords='startX="120" startY="120" endX="204" endY="120"' if radial else 'startX="36" startY="36" endX="204" endY="204"'
    r=f'<Fill><{tag} {coords}><GradientStop colorValue="FF4263EB" position="0"/><GradientStop id="0:10" colorValue="FFD97757" position="1"/></{tag}></Fill>'
    acoords='cx="10" cy="10" r="7"' if radial else 'x1="3" y1="3" x2="17" y2="17"'
    atag='radialGradient' if radial else 'linearGradient'
    a=f'<rect id="a" x0="3" y0="3" width="14" height="14"><{atag} {acoords}><stop offset="0" stop-color="#4263eb"/><stop offset="1" stop-color="#d97757"/></{atag}></rect>'
    track='<track target="a.fill.stops.1.position">0 1; 1 0.3</track>' if kind=='animated-stop' else ''
    cases.append(save(kind,a,shape(rectangle(),r),track,animation('0:10','position',1,.3) if track else ''))
for relative in [False,True]:
    name='dashes-percent' if relative else 'dashes-absolute'
    dash='12.5% 6.25%' if relative else '2 1'
    rv=f'<Stroke thickness="12" cap="butt">{solid(INK)}<DashPath><Dash length="{.125 if relative else 24}" lengthIsPercentage="{str(relative).lower()}"/><Dash length="{.0625 if relative else 12}" lengthIsPercentage="{str(relative).lower()}"/></DashPath></Stroke>'
    cases.append(save(name,f'<path id="a" d="M2 10L18 10" stroke="{INK}" stroke-width="1" stroke-linecap="butt" stroke-dasharray="{dash}"/>',shape(path([(2,10),(18,10)],False),rv)))
cases.append(save('ellipse','<ellipse id="a" cx="10" cy="10" rx="7" ry="4" fill="#4263eb"/>',shape('<Ellipse x="120" y="120" width="168" height="96"/>')))
pts=[(10+7*math.sin(i*2*math.pi/5),10-7*math.cos(i*2*math.pi/5)) for i in range(5)]
cases.append(save('polygon-rounded','<polygon id="a" cx="10" cy="10" sides="5" radius="7" cornerRadius="1" fill="#4263eb"/>',shape(rounded(pts,[1]*5))))
cases.append(save('star','<star id="a" cx="10" cy="10" points="5" radius="7" innerRadius="3.5" fill="#4263eb"/>',shape('<Star x="120" y="120" width="168" height="168" points="5" innerRadius="0.5"/>')))
cases.append(save('rect-corners','<rect id="a" x0="3" y0="3" width="14" height="14" corners="1 2 3 0" fill="#4263eb"/>',shape(rounded([(3,3),(17,3),(17,17),(3,17)],[1,2,3,0]))))
geom='<PointsPath isClosed="true">'+point(3,4)+point(17,4)+point(10,16,'id="0:20"')+'</PointsPath>'
cases.append(save('path-morph','<path id="a" d="M3 4L17 4L10 16Z" fill="#4263eb"/>',shape(geom),'<track target="a.d">0 "M3 4L17 4L10 16Z"; 1 "M3 4L17 4L16 16Z"</track>',animation('0:20','x',120,192)))
for mode in ['multiply','screen']:
    a=f'<rect id="b" x0="2" y0="2" width="12" height="12" fill="#d97757"/><rect id="a" x0="6" y0="6" width="12" height="12" fill="#4263eb" mix-blend-mode="{mode}"/>'
    rv=shape(rectangle(6,6,12,12),f'<Fill blendModeValue="{mode}">{solid(INK)}</Fill>')+shape(rectangle(2,2,12,12),fill('#d97757'))
    cases.append(save('blend-'+mode,a,rv))
for mask in [False,True]:
    name='alpha-mask' if mask else 'clip'
    src=shape('<Ellipse x="120" y="120" width="144" height="96"/>',fill('#ffffff80') if mask else '', 'id="0:30"')
    rv=(f'<LayerMask sourceId="0:30" maskModeValue="alpha" isVisible="true" sourceDraws="false"/>' if mask else '<ClippingShape sourceId="0:30"/>')+shape(rectangle())
    a=f'<ellipse id="source" cx="10" cy="10" rx="6" ry="4"'+(' fill="#ffffff80"' if mask else ' fill="#00000000"')+'/>'
    a+='<rect id="a" x0="3" y0="3" width="14" height="14" fill="#4263eb">'+('<mask source="source" mode="alpha" source-draws="false"/>' if mask else '<clip source="source"/>')+'</rect>'
    cases.append(save(name,a,'<Node>'+rv+'</Node>'+src))
for position in ['inside','outside']:
    a=f'<rect id="a" x0="4" y0="4" width="12" height="12" fill="#d97757" stroke="#4263eb" stroke-width="1" stroke-position="{position}" stroke-linejoin="miter"/>'
    rv=fill('#d97757')+f'<Stroke thickness="12" position="{position}" join="miter">{solid(INK)}</Stroke>'
    cases.append(save('stroke-'+position,a,shape(rectangle(4,4,12,12),rv)))
a='<rect id="a" x0="4" y0="4" width="12" height="12"><fillPaint fill="#d97757"/><strokePaint stroke="#4263eb" stroke-width="2" stroke-linejoin="miter"/><strokePaint stroke="#ffffff" stroke-width="0.5" stroke-linejoin="miter"/></rect>'
rv=fill('#d97757')+f'<Stroke thickness="24" join="miter">{solid(INK)}</Stroke><Stroke thickness="6" join="miter">{solid("#ffffff")}</Stroke>'
cases.append(save('multiple-paints',a,shape(rectangle(4,4,12,12),rv)))
budgets = {
 'linear': (2, 0), 'radial': (2, 0), 'animated-stop': (2, 0),
 'dashes-absolute': (110, .3), 'dashes-percent': (110, .3),
 'ellipse': (90, .4), 'polygon-rounded': (80, .35), 'star': (80, .45),
 'rect-corners': (90, .12), 'path-morph': (65, .4),
 'blend-multiply': (2, 0), 'blend-screen': (2, 0), 'clip': (90, .4),
 'alpha-mask': (50, .25), 'stroke-inside': (2, 0), 'stroke-outside': (2, 0),
 'multiple-paints': (2, 0),
}
for c in cases:
 c.update(threshold=16, maxDiff=budgets[c['name']][0], maxOverPercent=budgets[c['name']][1])
(ROOT/'cases.json').write_text(json.dumps(cases,indent=2)+'\n')
print(f'Authored {len(cases)} cases')

#!/usr/bin/env python3
"""Author independent motion comparisons and recapture with the offline command runner."""
import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--only', help='Capture only this named probe')
args = parser.parse_args()

ROOT = Path(__file__).resolve().parents[2] / 'tests/oracle'
RIVE = str(Path.home() / '.rive/bin/rive')
SHAPE = '<Shape id="0:3"><Rectangle x="24" y="96" width="24" height="48" originX="0" originY="0"/><Fill><SolidColor colorValue="FF4263EB"/></Fill></Shape>'
NODE = '<rect id="a" x0="2" y0="8" width="2" height="4" fill="#4263eb"/>'


def keys(obj, prop, values, kind='Double', hold=False):
    return f'<KeyedObject objectId="{obj}"><KeyedProperty property="{prop}">' + ''.join(
        f'<KeyFrame{kind} frame="{frame}" value="{value}" interpolationType="{"hold" if hold else "linear"}"/>' for frame, value in values
    ) + '</KeyedProperty></KeyedObject>'


def animation(ident, body):
    return f'<LinearAnimation id="{ident}" name="{ident.replace(":", "_")}" fps="60" duration="120">{body}</LinearAnimation>'


def machine(state):
    return f'<StateMachine name="s" id="0:101"><StateMachineLayer><EntryState><StateTransition stateToId="0:102"/></EntryState>{state}</StateMachineLayer></StateMachine>'


def playing():
    return machine('<AnimationState id="0:102" animationId="0:100"/>')


def viewmodel(kind, value):
    return f'<ViewModel name="Model" id="0:40" defaultInstanceId="0:41"><ViewModelProperty{kind} id="0:42" name="v"/><ViewModelInstance name="Default" id="0:41" exports="true"><ViewModelInstance{kind} viewModelPropertyId="0:42" propertyValue="{value}"/></ViewModelInstance></ViewModel>'


def save(name, ani, scene, times, commands=None, model='', **options):
    if args.only and name != args.only:
        return None
    d = ROOT / name
    r = d / 'rive'
    (r / 'frames').mkdir(exist_ok=True)
    (d / 'case.animl').write_text(f'<anima version="0.1" name="{name}" grid="20" requires="motion">{ani}</anima>\n')
    (r / 'scene.rml').write_text(f'<Rive version="1" kind="fragment"><Artboard name="Oracle" id="0:1" width="240" height="240" styleId="0:2" defaultStateMachineId="0:101"'+(' viewModelId="0:40"' if model else '')+f'><LayoutComponentStyle id="0:2"/><Fill><SolidColor colorValue="FFFFFFFF"/></Fill>{scene}</Artboard>{model}</Rive>\n')
    (r / 'rive.yaml').write_text(f'name: oracle-{name}\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
    if commands is None:
        commands = []
        previous = 0
        for t in times:
            if t > previous:
                commands.append(f'advance {round((t-previous)*1000)}ms')
            commands.append(f'{"data-dump" if options.get("values") else "screenshot"} frames/{t}.{"json" if options.get("values") else "png"}')
            previous = t
    (r / 'commands.txt').write_text('\n'.join(commands)+'\n')
    try:
        result = subprocess.run([RIVE, '.', '--commands=commands.txt'], cwd=r, capture_output=True, text=True, timeout=60)
        (r / 'capture.log').write_text(result.stdout+result.stderr)
        if result.returncode or 'err ' in result.stdout:
            raise RuntimeError(result.stdout+result.stderr)
    finally:
        for binary in r.rglob('*.riv'):
            binary.unlink()
    (d / 'todo.json').unlink(missing_ok=True)
    # Remove the obsolete scaffold text; these are now authored sources.
    (r / 'README.md').unlink(missing_ok=True)
    return dict(name=name, times=times, threshold=16, maxDiff=2, maxOverPercent=0, **options)


selected = []
# T(p) R T(-p), with independently keyed parent and child translations.
# A 180-degree turn keeps all sampled edges integral and makes both axes observable.
ani = '<rect id="a" x0="8" y0="8" width="2" height="4" rotate="180" fill="#4263eb"/>'
ani += '<timeline name="t" duration="2"><track target="a.pivotX">0 6;2 8</track><track target="a.pivotY">0 7;2 9</track></timeline><layer name="l" initial="s"><state name="s" play="t"/></layer>'
scene = '<Node id="0:4" x="72" y="84" rotation="3.141592653589793"><Node id="0:5" x="-72" y="-84">'+SHAPE.replace('x="24"', 'x="96"')+'</Node></Node>'
body = keys('0:4', 'x', [(0,72),(120,96)])+keys('0:4','y',[(0,84),(120,108)])+keys('0:5','x',[(0,-72),(120,-96)])+keys('0:5','y',[(0,-84),(120,-108)])
selected.append(save('transforms-origin-animation', ani, scene+animation('0:100',body)+playing(), [0,1,2]))

for discrete in [False, True]:
    name = 'animation-mix-discrete' if discrete else 'animation-mix-numeric'
    prop = 'a.visible' if discrete else 'a.x'
    a,b = ('true','false') if discrete else ('0','8')
    ani = NODE+f'<timeline name="a" duration="2"><track target="{prop}">0 {a};2 {a}</track></timeline><timeline name="b" duration="2"><track target="{prop}">0 {b};2 {b}</track></timeline>'
    # The native direct blend mixes two native animations sequentially, just like instances.
    scene = SHAPE
    if discrete:
        scene = scene.replace('<Rectangle ', '<CustomPropertyBoolean id="0:6" propertyValue="true"><DataBindContext sourcePathIds="0:40-0:42" propertyKey="245" direction="true"/></CustomPropertyBoolean><Rectangle ',1)
    body1 = keys('0:6' if discrete else '0:3', 'propertyValue' if discrete else 'x', [(0, a if discrete else 0)], 'Bool' if discrete else 'Double', True)
    body2 = keys('0:6' if discrete else '0:3', 'propertyValue' if discrete else 'x', [(0, b if discrete else 96)], 'Bool' if discrete else 'Double', True)
    state = '<BlendStateDirect id="0:102"><BlendAnimationDirect animationId="0:100" blendSource="mixValue" mixValue="100"/><BlendAnimationDirect animationId="0:110" blendSource="mixValue" mixValue="25"/></BlendStateDirect>'
    # Instances sample at zero time; the second contributes a positive partial weight.
    script = 'instance first a 1\ninstance second b 0.25\nadvance 0'
    if discrete:
        selected.append(save(name, ani, scene+animation('0:100',body1)+animation('0:110',body2)+machine(state), [0], scripts={'0':script}, model=viewmodel('Boolean','true'), values={'address':'a.visible','path':'v','tolerance':0}))
    else:
        state = state.replace('blendSource="mixValue" mixValue="25"/>', 'blendSource="dataBindId"><BindablePropertyNumber><DataBindContext sourcePathIds="0:40-0:42" propertyKey="636"/></BindablePropertyNumber></BlendAnimationDirect>')
        times = [0,0.25,0.5,1]
        commands = []; scripts = {}
        for t in times:
            commands += [f'data v={t*100}',f'screenshot frames/{t}.png']
            scripts[str(t)] = f'instance first a 1\ninstance second b {t}\nadvance 0'
        selected.append(save(name, ani, scene+animation('0:100',body1)+animation('0:110',body2)+machine(state), times, commands, viewmodel('Number',0), scripts=scripts))

for name, kind, first,last,tag,propkey in [
    ('animation-keys-string','String','one two','three','String',246),
    ('animation-keys-unsigned-integer','Number','0','2147483520','Uint',870),
]:
    custom = 'String' if kind == 'String' else 'Trigger'
    scene = f'<CustomPropertyGroup><CustomProperty{custom} id="0:44" propertyValue="{first}"><DataBindContext sourcePathIds="0:40-0:42" propertyKey="{propkey}" direction="true"/></CustomProperty{custom}></CustomPropertyGroup>'
    values = [(0,first),(60,last)] if kind == 'String' else [(0,0),(20,7),(40,42),(60,2147483520)]
    scene += animation('0:100',keys('0:44','propertyValue',values,tag,True))+playing()
    ani = (ROOT/name/'case.animl').read_text().split('requires="motion">',1)[1].rsplit('</anima>',1)[0]
    times = [0,0.5,1.1,2] if kind == 'String' else [0,0.5,0.8,1.1,2]
    selected.append(save(name,ani,scene,times,model=viewmodel(kind,first),values={'address':'a.channels.v','path':'v','tolerance':0}))

# Joystick is a native timeline sampler driven by commands/data, including backwards jumps.
# This compares seek/scrub poses only; host clock/event guarantees remain API tests.
for scrub in [False,True]:
    name = 'host-api-scrub' if scrub else 'animation-seek'
    work = ' work="0.5 1.5"' if scrub else ''
    ani = NODE+f'<timeline name="t" duration="2"{work}><track target="a.x">0 0;2 8</track></timeline>'
    scene = SHAPE+'<Joystick xId="0:100"><DataBindContext sourcePathIds="0:40-0:42" propertyKey="299"/></Joystick>'+animation('0:100',keys('0:3','x',[(0,0),(120,96)]))+machine('<AnimationState id="0:102" animationId="0:110"/>')+animation('0:110','')
    times = [0,0.25,0.75,1]
    progress = [0.75,0.25,1,0]
    commands = []; scripts = {}; sequence = []
    for t,p in zip(times,progress):
        source_time = 0.5+p if scrub else p*2
        commands += [f'data v={source_time-1}',f'screenshot frames/{t}.png']
        sequence += [f'timeline t {"scrub" if scrub else "seek"} {p if scrub else source_time}', 'advance 0']
        scripts[str(t)] = '\n'.join(sequence)
    selected.append(save(name,ani,scene,times,commands,viewmodel('Number',0),scripts=scripts))

selected = [c for c in selected if c is not None]
manifest = json.loads((ROOT/'cases.json').read_text())
names = {c['name'] for c in selected}
updates = {c['name']: c for c in selected}
existing = {c['name'] for c in manifest}
manifest = [updates.get(c['name'], c) for c in manifest] + [c for c in selected if c['name'] not in existing]
(ROOT/'cases.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Captured', ', '.join(names))

#!/usr/bin/env python3
"""Original native paired scenes; only local headless commands, never read a binary."""
from pathlib import Path
import json
import shutil
import subprocess
root = Path(__file__).resolve().parents[2]
features = ['rigging-joystick', 'animation-joystick-two-axis', 'animation-joystick-invert', 'animation-joystick-handle']
for feature in features:
    d = root/'tests/oracle'/feature
    r = d/'rive'
    (r/'frames').mkdir(exist_ok=True)
    handle = feature == 'animation-joystick-handle'
    inverted = feature == 'animation-joystick-invert'
    inv = ' invertX="true"' if inverted else ''
    driver_id = '0:4' if handle else '0:5'
    x0, x1, y0, y1 = (72,168,168,72) if handle else (-1,1,1,-1)
    fields = ' handleSourceId="0:4" posX="120" posY="120" width="96" height="96"' if handle else ''
    source = f'''<Rive version="1" kind="fragment"><Artboard name="Oracle" id="0:1" width="240" height="240" styleId="0:2" defaultStateMachineId="0:101">
<LayoutComponentStyle id="0:2"/><Fill><SolidColor colorValue="FFFFFFFF"/></Fill>
<Shape id="0:3"><Rectangle x="120" y="120" width="24" height="24"/><Fill><SolidColor colorValue="FF141413"/></Fill></Shape>
<Node id="0:4" x="72" y="168"/>
<Joystick id="0:5" name="Control" x="-1" y="1" xId="0:10" yId="0:11"{inv}{fields}/>
<LinearAnimation name="horizontal" id="0:10" fps="60" duration="120"><KeyedObject objectId="0:3"><KeyedProperty property="x"><KeyFrameDouble frame="0" value="-48" interpolationType="linear"/><KeyFrameDouble frame="120" value="48"/></KeyedProperty></KeyedObject></LinearAnimation>
<LinearAnimation name="vertical" id="0:11" fps="60" duration="240"><KeyedObject objectId="0:3"><KeyedProperty property="y"><KeyFrameDouble frame="0" value="-48" interpolationType="linear"/><KeyFrameDouble frame="240" value="48"/></KeyedProperty></KeyedObject></LinearAnimation>
<LinearAnimation name="drive" id="0:100" fps="60" duration="60"><KeyedObject objectId="{driver_id}"><KeyedProperty property="x"><KeyFrameDouble frame="0" value="{x0}" interpolationType="linear"/><KeyFrameDouble frame="60" value="{x1}"/></KeyedProperty><KeyedProperty property="y"><KeyFrameDouble frame="0" value="{y0}" interpolationType="linear"/><KeyFrameDouble frame="60" value="{y1}"/></KeyedProperty></KeyedObject></LinearAnimation>
<StateMachine name="s" id="0:101"><StateMachineLayer name="l"><EntryState><StateTransition stateToId="0:102"/></EntryState><AnimationState id="0:102" animationId="0:100"/></StateMachineLayer></StateMachine></Artboard></Rive>
'''
    (r/'scene.rml').write_text(source)
    (r/'rive.yaml').write_text(f'name: oracle-{feature}\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
    commands = []
    for t in [0,.25,.5,.75,1]:
        if t: commands.append('advance 250ms')
        commands.append(f'screenshot frames/{t}.png')
    (r/'commands.txt').write_text('\n'.join(commands)+'\n')
    try:
        result = subprocess.run([str(Path.home()/'.rive/bin/rive'),'.','--commands=commands.txt'],cwd=r,capture_output=True,text=True,timeout=120)
        (r/'capture.log').write_text(result.stdout+result.stderr)
        if result.returncode or 'err ' in result.stdout: raise RuntimeError((result.stdout+result.stderr)[-5000:])
        for t in [0,.25,.5,.75,1]: assert (r/'frames'/f'{t}.png').exists(), (feature,t)
    finally:
        for binary in r.rglob('*.riv'): binary.unlink()
        shutil.rmtree(r/'build',ignore_errors=True)
    pad = f'<posepad id="pad" timeline-x="horizontal" timeline-y="vertical"'+(' invert-x="true"' if inverted else '')+(' handle="handle" box="6 6 8 8"' if handle else '')+'/>'
    driver = '<track target="handle.x">0 6; 1 14</track><track target="handle.y">0 14; 1 6</track>' if handle else '<track target="pad.value-x">0 -1; 1 1</track><track target="pad.value-y">0 1; 1 -1</track>'
    (d/'case.animl').write_text(f'''<anima version="0.1" name="{feature}" grid="20" requires="posepad">
<rect id="eye" x0="9" y0="9" width="2" height="2" fill="#141413"/>
<group id="handle"/>{pad}
<timeline name="horizontal" duration="2"><track target="eye.x">0 -4; 2 4</track></timeline>
<timeline name="vertical" duration="4"><track target="eye.y">0 -4; 4 4</track></timeline>
<timeline name="drive" duration="1">{driver}</timeline>
<layer name="l" initial="s"><state name="s" play="drive"/></layer>
</anima>\n''')
    (r/'README.md').write_text('Original two-axis control scene at 12 pixels per Anima unit. Rectangle geometry is identical; timelines cover two and four seconds. Driver clock covers one second. Handle reference uses keyed node positions. Native command: `~/.rive/bin/rive . --commands=commands.txt`. No native docs or binary files are committed.\n')
    (d/'todo.json').write_text(json.dumps({'status':'todo','reason':'Native reference frames captured; raw measurements in modules/posepad/RAW-METRICS.json. Orchestrator must select unchanged-method AA budgets and add completed cases to cases.json.'},indent=2)+'\n')
    print(feature, 'captured', flush=True)

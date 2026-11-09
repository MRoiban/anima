#!/usr/bin/env python3
"""Original native probes. No Rive binaries are read or retained."""
import base64
import json
from pathlib import Path
import shutil
import subprocess
root = Path(__file__).resolve().parents[2]
for name in ['rigging-mesh', 'rigging-mesh-animation']:
    folder = root / 'tests/oracle' / name
    project = folder / 'rive'
    project.mkdir(exist_ok=True)
    (project / 'frames').mkdir(exist_ok=True)
    shutil.copyfile(root / 'modules/mesh/test/fixtures/flag.png', project / 'flag.png')
    doc = json.loads((root / 'spec/conformance' / name / 'case.ani').read_text())
    animated = name.endswith('animation')
    images = []
    for node in reversed(doc['nodes']):
        m = node['mesh']
        if 'grid' in m:
            cols, rows = m['grid']
            vertices = [[node['x0'] + node['width']*x/cols, node['y0'] + node['height']*y/rows, x/cols, y/rows] for y in range(rows+1) for x in range(cols+1)]
            triangles = []
            for y in range(rows):
                for x in range(cols):
                    a = y*(cols+1)+x; b = a+cols+1
                    triangles += [[a,a+1,b+1],[a,b+1,b]]
        else:
            vertices, triangles = m['vertices'], m['triangles']
        if animated:
            vertices[3][1] = 12  # independently evaluate the constant binding max(5,12)
        indices = base64.b64encode(bytes(k for t in triangles for k in t)).decode()
        verts = ''.join(f'<MeshVertex id="0:{300+k}" x="{x*12}" y="{y*12}" u="{u}" v="{v}"/>' for k,(x,y,u,v) in enumerate(vertices))
        # Unique IDs needed only by the animated image; static probes have two images.
        if not animated:
            import re
            verts = re.sub(r' id="[^"]+"','',verts)
        images.append(f'<Image assetId="0:60" originX="0" originY="0"><Mesh triangleIndexBytes="{indices}">{verts}</Mesh></Image>')
    animation = ''
    if animated:
        keyed = []
        for prop, values in [('x',[120,114,120]),('y',[60,39,60])]:
            keys = ''.join(f'<KeyFrameDouble frame="{t}" value="{v}" interpolationType="linear"/>' for t,v in zip([0,30,60],values))
            keyed.append(f'<KeyedProperty property="{prop}">{keys}</KeyedProperty>')
        animation = '<LinearAnimation name="wave" id="0:100" fps="60" duration="60"><KeyedObject objectId="0:302">'+''.join(keyed)+'</KeyedObject></LinearAnimation><StateMachine name="run" id="0:101"><StateMachineLayer name="main"><EntryState><StateTransition stateToId="0:102"/></EntryState><AnimationState id="0:102" animationId="0:100"/></StateMachineLayer></StateMachine>'
    attr = ' defaultStateMachineId="0:101"' if animated else ''
    scene = f'<Rive version="1" kind="fragment"><Artboard name="Flag" id="0:1" width="240" height="240" styleId="0:2"{attr}><LayoutComponentStyle id="0:2"/><Fill><SolidColor colorValue="FFFFFFFF"/></Fill>'+''.join(images)+animation+'</Artboard><ImageAsset file="flag.png" name="flag" id="0:60" samplerFilter="0"/></Rive>\n'
    (project / 'scene.rml').write_text(scene)
    (project / 'rive.yaml').write_text(f'name: oracle-{name}\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
    times = [0,.25,.5,1] if animated else [0]
    commands = 'screenshot frames/0.png\n'
    previous = 0
    for time in times[1:]:
        commands += f'advance {int((time-previous)*1000)}ms\nscreenshot frames/{time}.png\n'; previous=time
    (project / 'commands.txt').write_text(commands)
    try:
        result = subprocess.run([str(Path.home()/'.rive/bin/rive'),'.','--commands=commands.txt'],cwd=project,capture_output=True,text=True)
        (project / 'session.txt').write_text(result.stdout+result.stderr)
        print(name, result.returncode, (result.stdout+result.stderr)[-1200:])
    finally:
        for binary in project.rglob('*.riv'): binary.unlink()
        shutil.rmtree(project / 'build',ignore_errors=True)

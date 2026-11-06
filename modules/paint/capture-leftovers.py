#!/usr/bin/env python3
"""Independent P4e-5 local scenes and path observations. Never reads native binaries."""
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ORACLE = ROOT / 'tests/oracle'
RIVE = str(Path.home() / '.rive/bin/rive')
DUMP = '''type Dump = {}
local function update(self: Dump, path: PathData, node: NodeReadData): PathData
    for index = 1, #path do
        local cmd: PathCommand = path[index]
        local line = "PATH " .. tostring(index) .. " " .. cmd.type
        for j = 1, #cmd do
            local pt = cmd[j]
            line = line .. " " .. tostring(pt.x) .. "," .. tostring(pt.y)
        end
        print(line)
    end
    return path
end
return function(): PathEffect<Dump>
    return { update = update }
end
'''

def capture(project):
    try:
        run = subprocess.run([RIVE, '.', '--commands=commands.txt'], cwd=project,
                             capture_output=True, text=True, check=True)
        if 'err ' in run.stdout:
            raise RuntimeError(run.stdout + run.stderr)
        return run.stdout + run.stderr
    finally:
        for binary in project.rglob('*.riv'):
            binary.unlink()


def wrap(shapes):
    return ('<Rive version="1" kind="fragment"><Artboard name="Oracle" id="0:1" '
            'width="240" height="240" styleId="0:2"><LayoutComponentStyle id="0:2"/>'
            '<Fill><SolidColor colorValue="FFffffff"/></Fill>' + shapes + '</Artboard></Rive>\n')


def rect(x, y, w, h, paint, attrs=''):
    return (f'<Shape {attrs}><Rectangle x="{x}" y="{y}" width="{w}" height="{h}" '
            f'originX="0" originY="0"/>{paint}</Shape>')


def fill(color, attrs=''):
    return f'<Fill {attrs}><SolidColor colorValue="FF{color}"/></Fill>'


def project(case, scene):
    path = ORACLE / ('drawing-paint-' + case) / 'rive'
    path.mkdir(parents=True, exist_ok=True)
    (path/'frames').mkdir(exist_ok=True)
    (path/'rive.yaml').write_text(f'name: paint-{case}\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
    (path/'scene.rml').write_text(scene)
    (path/'commands.txt').write_text('screenshot frames/0.png\n')
    capture(path)
    return path


def main():
    # Native gradient transform fields inspect correctly but do not affect this renderer.
    old = ORACLE/'drawing-paint-gradient-transform/rive'
    original = wrap(rect(0, 0, 240, 240,
        '<Fill><LinearGradient startX="0" startY="0" endX="240" endY="0" transformRotation="1.5707963267948966" transformX="240">'
        '<GradientStop colorValue="FF4263eb" position="0"/>'
        '<GradientStop colorValue="FFd97757" position="1"/></LinearGradient></Fill>'))
    with tempfile.TemporaryDirectory(prefix='anima-gradient-') as name:
        p = Path(name)
        shutil.copy(old/'rive.yaml', p/'rive.yaml')
        (p/'commands.txt').write_text('screenshot flags.png\n')
        (p/'scene.rml').write_text(original)
        capture(p)
        # Keep the observed ignored-field image; no transformation of reference pixels.
        shutil.copy(p/'flags.png', old/'ignored-transform.png')
        (p/'scene.rml').write_text(re.sub(r' transform(?:Rotation|X)="[^"]*"', '', original))
        (p/'commands.txt').write_text('screenshot plain.png\n')
        capture(p)
        shutil.copy(p/'plain.png', old/'untransformed.png')
    # Independently apply [0,1,-1,0,240,0] to the two endpoints. Geometry stays fixed.
    project('gradient-transform', wrap(rect(0, 0, 240, 240,
        '<Fill><LinearGradient startX="240" startY="0" endX="240" endY="240">'
        '<GradientStop colorValue="FF4263eb" position="0"/>'
        '<GradientStop colorValue="FFd97757" position="1"/></LinearGradient></Fill>')))
    for case in ['blend-additive', 'additive-strength', 'paint-blend-override', 'gradient-angular']:
        if case == 'gradient-angular':
            scene = rect(0, 0, 240, 240, '<Fill><AngularGradient startX="0" startY="0" endX="240" endY="0">'
                '<GradientStop colorValue="FF4263eb" position="0"/>'
                '<GradientStop colorValue="FFd97757" position="1"/></AngularGradient></Fill>')
        else:
            attrs = 'blendModeValue="additive"'
            paint = fill('804020')
            if case == 'additive-strength':
                attrs += ' additiveAmount="128"'
            if case == 'paint-blend-override':
                attrs = 'blendModeValue="multiply"'
                paint = fill('804020', 'blendModeValue="screen"') + '<Stroke thickness="12"><SolidColor colorValue="FF204080"/></Stroke>'
            scene = rect(48,48,144,144,paint,attrs) + rect(0,0,240,240,fill('204060'))
        project(case, wrap(scene))
    for case in ['effect-order', 'shared-effects']:
        def line(y, effects):
            return ('<Shape><PointsPath isClosed="false">'
                f'<StraightVertex x="24" y="{y}"/><StraightVertex x="216" y="{y}"/>'
                '</PointsPath><Stroke thickness="6" cap="butt" join="miter">'
                '<SolidColor colorValue="FF4263eb"/>' + effects + '</Stroke></Shape>')
        trim = '<TrimPath start="0.2" end="0.8" modeValue="sequential"/>' if case == 'effect-order' else '<TrimPath start="0.25" end="0.75" modeValue="sequential"/>'
        dash = '<DashPath><Dash length="24"/><Dash length="24"/></DashPath>'
        scene = line(60, trim + dash) + line(180, dash + trim) if case == 'effect-order' else line(60, trim) + line(180, trim)
        project(case, wrap(scene))
    # Observe the path AFTER native effects through an identity scripted path effect.
    for case in ['straight-vertex','mirrored-vertex','asymmetric-vertex','detached-vertex','rounded-vertex','trim-sequential','trim-synchronized','effect-order','shared-effects']:
        source = ORACLE/('drawing-paint-'+case)/'rive'
        with tempfile.TemporaryDirectory(prefix='anima-path-') as name:
            p=Path(name)
            shutil.copy(source/'rive.yaml', p/'rive.yaml')
            scene=(source/'scene.rml').read_text().replace('<Artboard', '<ScriptAsset id="0:80" name="dump" file="dump.luau"/><Artboard').replace('</Stroke>','<ScriptedPathEffect scriptAssetId="0:80"/></Stroke>')
            (p/'scene.rml').write_text(scene)
            (p/'dump.luau').write_text(DUMP)
            (p/'commands.txt').write_text('screenshot dump.png\n')
            log=capture(p)
            lines=list(dict.fromkeys(re.findall(r'^PATH .*',log,re.M)))
            (source/'path-dump.json').write_text(json.dumps(lines,indent=2)+'\n')
            # Retain our observer (no documentation/scaffold text) for independent reproduction.
            (source/'dump.luau').write_text(DUMP)
            print(case, lines)

if __name__ == '__main__':
    main()

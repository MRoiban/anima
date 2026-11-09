#!/usr/bin/env python3
"""Author and optionally capture the three P8-4 native skin probes.

The native scenes are independently authored from Anima's specified geometry. Generated
binary files and build directories are removed without being read.
"""
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INK = '<Fill><SolidColor colorValue="FFd97757"/></Fill>'
BG = '<LayoutComponentStyle id="0:2"/><Fill><SolidColor colorValue="FFffffff"/></Fill>'


def weight(values: int, indices: int, cubic: bool = False, **parts: int) -> str:
    tag = "CubicWeight" if cubic else "Weight"
    attrs = [f'values="{values}"', f'indices="{indices}"']
    for key, value in parts.items():
        attrs.append(f'{key}="{value}"')
    return f'<{tag} {' '.join(attrs)}/>'


def animation() -> str:
    return (
        '<LinearAnimation name="go" id="0:100" fps="60" duration="60" loopValue="oneShot">'
        '<KeyedObject objectId="0:10"><KeyedProperty property="rotation">'
        '<KeyFrameDouble frame="0" value="0" interpolationType="linear"/>'
        f'<KeyFrameDouble frame="60" value="{math.pi / 2}"/>'
        '</KeyedProperty></KeyedObject></LinearAnimation>'
        '<StateMachine name="sm" id="0:101"><StateMachineLayer name="main">'
        '<EntryState><StateTransition stateToId="0:102"/></EntryState>'
        '<AnimationState id="0:102" animationId="0:100"/>'
        '</StateMachineLayer></StateMachine>'
    )


def bones(two: bool) -> str:
    out = '<RootBone id="0:10" x="120" y="120" length="48"/>'
    if two:
        out += '<RootBone id="0:11" x="120" y="120" length="48"/>'
    return out


def skin(tendons: int) -> str:
    children = '<Tendon boneId="0:10" tx="120" ty="120"/>'
    if tendons == 2:
        children += '<Tendon boneId="0:11" tx="120" ty="120"/>'
    return f'<Skin>{children}</Skin>'


def native_quad(vertex_weights: list[str]) -> str:
    pts = [(120, 108), (168, 108), (168, 132), (120, 132)]
    vertices = ''.join(
        f'<StraightVertex x="{x}" y="{y}">{w}</StraightVertex>'
        for (x, y), w in zip(pts, vertex_weights)
    )
    return f'<Shape><PointsPath isClosed="true">{vertices}{skin(1 if vertex_weights[0].find('indices="513"') < 0 else 2)}</PointsPath>{INK}</Shape>'


def save(name: str, animl: str, native: str) -> None:
    directory = ROOT / "tests" / "oracle" / name
    project = directory / "rive"
    frames = project / "frames"
    frames.mkdir(parents=True, exist_ok=True)
    (directory / "case.animl").write_text(animl.rstrip() + "\n")
    (directory / "todo.json").write_text(
        json.dumps(
            {
                "status": "todo",
                "reason": "Native references and raw measurements are supplied; orchestrator must classify anti-aliasing and set fixed budgets.",
            },
            indent=2,
        )
        + "\n"
    )
    scene = (
        '<Rive version="1" kind="fragment"><Artboard name="Oracle" id="0:1" width="240" height="240" '
        'styleId="0:2" defaultStateMachineId="0:101">'
        + BG
        + native
        + animation()
        + "</Artboard></Rive>\n"
    )
    (project / "scene.rml").write_text(scene)
    (project / "rive.yaml").write_text(f"name: oracle-{name}\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n")
    (project / "commands.txt").write_text(
        f"screenshot {frames / '0.png'}\n"
        "advance 500ms\n"
        f"screenshot {frames / '0.5.png'}\n"
        "advance 501ms\n"
        f"screenshot {frames / '1.png'}\n"
    )
    (project / "README.md").write_text(
        "# Native skin probe\n\n"
        "Independently authored with explicit native vertex weights. Geometry uses 12 px per Anima grid unit; "
        "the moving root bone rotates from 0 to 90 degrees. Tendon bind translations store the shared rest origin. "
        "The last frame advances 1 ms beyond the once endpoint to avoid native float-clock drift. No native binary "
        "is read or retained, and comparison budgets remain owned by the orchestrator.\n"
    )
    if "--capture" not in sys.argv:
        return
    try:
        verify = subprocess.run(
            [str(Path.home() / ".rive/bin/rive"), str(project), "--verify"],
            text=True,
            capture_output=True,
            timeout=120,
        )
        if verify.returncode:
            raise RuntimeError(verify.stdout + verify.stderr)
        result = subprocess.run(
            [str(Path.home() / ".rive/bin/rive"), str(project), f"--commands={project / 'commands.txt'}"],
            text=True,
            capture_output=True,
            timeout=120,
        )
        (project / "session.txt").write_text(result.stdout + result.stderr)
        if result.returncode or not all((frames / f"{time}.png").exists() for time in ("0", "0.5", "1")):
            raise RuntimeError(result.stdout + result.stderr)
        print(name, "captured", flush=True)
    finally:
        for binary in project.rglob("*.riv"):
            binary.unlink()
        shutil.rmtree(project / "build", ignore_errors=True)


full = weight(255, 1)
save(
    "rigging-skin",
    '''<anima version="0.1" name="rigging-skin-oracle" grid="20" requires="paint rig skin">
  <bone id="move" x="10" y="10" length="4"/>
  <path id="quad" d="M10 9L14 9L14 11L10 11Z" fill="#d97757">
    <skin bones="move" weights='[{"point":{"move":1}},{"point":{"move":1}},{"point":{"move":1}},{"point":{"move":1}}]'/>
  </path>
  <timeline name="go" duration="1"><track target="move.rotate">0 0
1 90</track></timeline>
  <layer name="main" initial="go"><state name="go" play="go"/></layer>
</anima>''',
    bones(False) + native_quad([full] * 4),
)

mixed_values = 128 + (127 << 8)
mixed_indices = 1 + (2 << 8)
mixed = weight(mixed_values, mixed_indices)
save(
    "rigging-weights",
    '''<anima version="0.1" name="rigging-weights-oracle" grid="20" requires="paint rig skin">
  <bone id="move" x="10" y="10" length="4"/>
  <bone id="rest" x="10" y="10" length="4"/>
  <path id="quad" d="M10 9L14 9L14 11L10 11Z" fill="#d97757">
    <skin bones="move rest" weights='[{"point":{"move":0.5019607843137255,"rest":0.4980392156862745}},{"point":{"move":0.5019607843137255,"rest":0.4980392156862745}},{"point":{"move":0.5019607843137255,"rest":0.4980392156862745}},{"point":{"move":0.5019607843137255,"rest":0.4980392156862745}}]'/>
  </path>
  <timeline name="go" duration="1"><track target="move.rotate">0 0
1 90</track></timeline>
  <layer name="main" initial="go"><state name="go" play="go"/></layer>
</anima>''',
    bones(True) + native_quad([mixed] * 4),
)

static = weight(255, 2)
first = weight(255, 2, True, inValues=255, inIndices=2, outValues=255, outIndices=1)
second = weight(255, 2, True, inValues=255, inIndices=2, outValues=255, outIndices=2)
cubic_native = (
    bones(True)
    + '<Shape><PointsPath isClosed="true">'
    + f'<CubicDetachedVertex x="96" y="96" inRotation="0" inDistance="0" outRotation="0" outDistance="16">{first}</CubicDetachedVertex>'
    + f'<CubicDetachedVertex x="144" y="96" inRotation="{math.pi}" inDistance="16" outRotation="0" outDistance="0">{second}</CubicDetachedVertex>'
    + f'<StraightVertex x="144" y="144">{static}</StraightVertex>'
    + f'<StraightVertex x="96" y="144">{static}</StraightVertex>'
    + skin(2)
    + f'</PointsPath>{INK}</Shape>'
)
save(
    "rigging-cubic-weights",
    '''<anima version="0.1" name="rigging-cubic-weights-oracle" grid="20" requires="paint rig skin">
  <bone id="move" x="10" y="10" length="4"/>
  <bone id="rest" x="10" y="10" length="4"/>
  <path id="quad" d="M8 8C9.3333333333 8 10.6666666667 8 12 8L12 12L8 12Z" fill="#d97757">
    <skin bones="move rest" weights='[{"point":{"rest":1},"out":{"move":1}},{"point":{"rest":1},"in":{"rest":1}},{"point":{"rest":1}},{"point":{"rest":1}}]'/>
  </path>
  <timeline name="go" duration="1"><track target="move.rotate">0 0
1 90</track></timeline>
  <layer name="main" initial="go"><state name="go" play="go"/></layer>
</anima>''',
    cubic_native,
)

"""Independent input scenes. Uses only local RML and headless --commands; never reads .riv."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
for phase, rive_phase in [('drag-start', 'dragStart'), ('drag', 'drag'), ('drag-end', 'dragEnd')]:
    name = 'input-pointer-' + phase
    target = ROOT / 'tests/oracle' / name / 'rive'
    (target / 'frames').mkdir(parents=True, exist_ok=True)
    scene = f'''<Rive version="1" kind="fragment">
<Artboard name="Input" id="0:1" width="240" height="240" defaultStateMachineId="0:10">
<Fill><SolidColor colorValue="FFFFFFFF"/></Fill>
<Shape id="0:3"><Rectangle x="24" y="96" width="48" height="48" originX="0" originY="0"/><Fill><SolidColor colorValue="FF4263EB"/></Fill></Shape>
<LinearAnimation id="0:4" name="idle" fps="60" duration="60"><KeyedObject objectId="0:3"><KeyedProperty property="x"><KeyFrameDouble frame="0" value="0"/></KeyedProperty></KeyedObject></LinearAnimation>
<LinearAnimation id="0:5" name="active" fps="60" duration="60"><KeyedObject objectId="0:3"><KeyedProperty property="x"><KeyFrameDouble frame="0" value="96"/></KeyedProperty></KeyedObject></LinearAnimation>
<StateMachine id="0:10" name="input"><StateMachineBool id="0:11" name="active" value="false"/>
<StateMachineListenerSingle targetId="0:3" listenerTypeValue="drag"/>
<StateMachineListenerSingle targetId="0:3" listenerTypeValue="{rive_phase}"><ListenerBoolChange inputId="0:11" value="true"/></StateMachineListenerSingle>
<StateMachineLayer name="main"><EntryState><StateTransition stateToId="0:12"/></EntryState>
<AnimationState id="0:12" animationId="0:4"><StateTransition stateToId="0:13" duration="0"><TransitionBoolCondition inputId="0:11" opValue="equal"/></StateTransition></AnimationState>
<AnimationState id="0:13" animationId="0:5"/>
</StateMachineLayer></StateMachine>
</Artboard></Rive>'''
    (target / 'scene.rml').write_text(scene + '\n')
    (target / 'rive.yaml').write_text('name: input-oracle\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
    (target / 'commands.txt').write_text('screenshot frames/0.png\npointer down@36,120\npointer move@48,120\nadvance 0\nscreenshot frames/1.png\npointer up@48,120\nadvance 0\nscreenshot frames/2.png\n')
    try:
        result = subprocess.run([str(Path.home() / '.rive/bin/rive'), '.', '--commands=commands.txt'], cwd=target, capture_output=True, text=True, timeout=60)
        (target / 'capture.log').write_text(result.stdout + result.stderr)
        if result.returncode or 'err ' in result.stdout:
            raise RuntimeError(result.stdout + result.stderr)
    finally:
        for output in target.rglob('*.riv'):
            output.unlink()

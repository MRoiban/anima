from pathlib import Path
import json,subprocess
root=Path(__file__).resolve().parents[2]/'tests/oracle';name='state-machine-exit-time-seconds';d=root/name;r=d/'rive';(r/'frames').mkdir(exist_ok=True)
ani='<anima version="0.1" name="state-machine-exit-time-seconds" grid="20" requires="motion"><rect id="a" x0="2" y0="8" width="2" height="4" fill="#4263eb"/><timeline name="t" duration="2"><track target="a.x">0 0;2 8</track></timeline><timeline name="u" duration="1"><track target="a.x">0 0;1 0</track><track target="a.y">0 0;1 4</track></timeline><layer name="l" initial="s"><state name="s" play="t" speed="2"><on when="@after(0)" to="next" exit="1"/></state><state name="next" play="u"/></layer></anima>\n'
(d/'case.animl').write_text(ani)
shape='<Shape id="0:3"><Rectangle x="24" y="96" width="24" height="48" originX="0" originY="0"/><Fill><SolidColor colorValue="FF4263EB"/></Fill></Shape>'
def keys(prop,last,endframe=60):return f'<KeyedProperty property="{prop}"><KeyFrameDouble frame="0" value="0" interpolationType="linear"/><KeyFrameDouble frame="{endframe}" value="{last}"/></KeyedProperty>'
rv=f'<Rive version="1" kind="fragment"><Artboard name="Oracle" id="0:1" width="240" height="240" styleId="0:2" defaultStateMachineId="0:101"><LayoutComponentStyle id="0:2"/><Fill><SolidColor colorValue="FFFFFFFF"/></Fill>{shape}<LinearAnimation name="t" id="0:100" fps="60" duration="120"><KeyedObject objectId="0:3">{keys("x",96,120)}</KeyedObject></LinearAnimation><LinearAnimation name="u" id="0:110" fps="60" duration="60"><KeyedObject objectId="0:3">{keys("x",0)}{keys("y",48)}</KeyedObject></LinearAnimation><StateMachine name="s" id="0:101"><StateMachineLayer name="l"><EntryState><StateTransition stateToId="0:102"/></EntryState><AnimationState id="0:102" animationId="0:100" speed="2"><StateTransition stateToId="0:112" enableExitTime="true" exitTime="1000" duration="0"/></AnimationState><AnimationState id="0:112" animationId="0:110"/></StateMachineLayer></StateMachine></Artboard></Rive>\n'
(r/'scene.rml').write_text(rv);(r/'rive.yaml').write_text('name: oracle-motion-exit\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n');(r/'commands.txt').write_text('screenshot frames/0.png\nadvance 250ms\nscreenshot frames/0.25.png\nadvance 500ms\nscreenshot frames/0.75.png\nadvance 750ms\nscreenshot frames/1.5.png\n')
try:
 result=subprocess.run([str(Path.home()/'.rive/bin/rive'),'.','--commands=commands.txt'],cwd=r,capture_output=True,text=True,check=True,timeout=60)
 (r/'capture.log').write_text(result.stdout+result.stderr)
 if 'err ' in result.stdout:raise RuntimeError(result.stdout)
finally:
 for p in r.rglob('*.riv'):p.unlink()
(d/'todo.json').unlink(missing_ok=True)
cases=json.loads((root/'cases.json').read_text());cases=[c for c in cases if c['name']!=name];cases.append(dict(name=name,times=[0,.25,.75,1.5],threshold=16,maxDiff=2,maxOverPercent=0));(root/'cases.json').write_text(json.dumps(cases,indent=2)+'\n')

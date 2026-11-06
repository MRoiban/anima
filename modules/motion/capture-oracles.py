#!/usr/bin/env python3
"""Independently author native Rive motion probes and capture PNGs; never read binaries."""
import json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'tests/oracle'
selected=[]
for feature in ['animation-cubic-value','animation-elastic-in','animation-elastic-in-out','animation-quantized-playback','animation-reverse','animation-work-area']:
 d=root/feature;r=d/'rive';(r/'frames').mkdir(exist_ok=True)
 # Axial integer rectangles: no rasterizer allowance is needed at the sampled positions.
 node='<rect id="a" x0="2" y0="8" width="2" height="4" fill="#4263eb"/>'
 shape='<Shape id="0:3"><Rectangle x="24" y="96" width="24" height="48" originX="0" originY="0"/><Fill><SolidColor colorValue="FF4263EB"/></Fill></Shape>'
 duration=2;fps=60;endframe=120;times=[0,1,2];animattrs='';props='x';first=0;last=96;ease='linear';interp='';extra='';stateattrs='';track='0 0;2 8'
 if feature=='animation-cubic-value':
  track='0 0 value-cubic(0.3333333333333333,8,0.6666666666666666,8);2 0';last=0
  interp='<CubicValueInterpolator id="0:20" x1="0.3333333333333333" y1="96" x2="0.6666666666666666" y2="96"/>';ease='cubicValue';extra=' interpolatorId="0:20"'
 elif feature.startswith('animation-elastic'):
  easing='easeInOut' if feature.endswith('in-out') else 'easeIn'
  curve='elastic-in-out' if feature.endswith('in-out') else 'elastic-in'
  track=f'0 0 {curve}(1,0.5);2 8';interp=f'<ElasticInterpolator id="0:20" easingValue="{easing}" amplitude="1" period="0.5"/>';ease='elastic';extra=' interpolatorId="0:20"'
  # In-out midpoint and endpoints are integral; elastic-in midpoint is 3 px (8 units / 32).
 elif feature=='animation-quantized-playback':
  fps=2;endframe=4;animattrs=' quantize="true"';stateattrs=' quantize="2"';times=[0,.75,1.25,2]
 elif feature=='animation-reverse':
  animattrs=' speed="-1"';stateattrs=' speed="-1"';times=[0,.5,1,2]
 elif feature=='animation-work-area':
  animattrs=' workStart="30" workEnd="90" enableWorkArea="true" loopValue="loop"';stateattrs=' work="0.5 1.5" loop="loop"';times=[0,.25,.75,1.25]

 tracks=f'<timeline name="t" duration="2"{stateattrs}><track target="a.x">{track}</track></timeline><layer name="l" initial="s"><state name="s" play="t"/></layer>'
 source=f'<anima version="0.1" name="{feature}" grid="20" requires="motion">{node}{tracks}</anima>\n'
 (d/'case.animl').write_text(source)
 # Reverse's authored timeline speed is separate from its state multiplier.
 rv=f'<Rive version="1" kind="fragment"><Artboard name="Oracle" id="0:1" width="240" height="240" styleId="0:2" defaultStateMachineId="0:101"><LayoutComponentStyle id="0:2"/><Fill><SolidColor colorValue="FFFFFFFF"/></Fill>{shape}{interp}<LinearAnimation name="t" id="0:100" fps="{fps}" duration="{endframe}"{animattrs}><KeyedObject objectId="0:3"><KeyedProperty property="{props}"><KeyFrameDouble frame="0" value="{first}" interpolationType="{ease}"{extra}/><KeyFrameDouble frame="{endframe}" value="{last}"/></KeyedProperty></KeyedObject></LinearAnimation><StateMachine name="s" id="0:101"><StateMachineLayer name="l"><EntryState><StateTransition stateToId="0:102"/></EntryState><AnimationState id="0:102" animationId="0:100"/></StateMachineLayer></StateMachine></Artboard></Rive>\n'
 (r/'scene.rml').write_text(rv);(r/'rive.yaml').write_text(f'name: oracle-{feature}\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
 commands=[];previous=0
 for at in times:
  if at>previous:commands.append(f'advance {round((at-previous)*1000)}ms')
  if feature=='animation-quantized-playback' and at==2:commands.append('advance 1ms')
  commands.append(f'screenshot frames/{at}.png');previous=at
 (r/'commands.txt').write_text('\n'.join(commands)+'\n')
 try:
  result=subprocess.run([str(Path.home()/'.rive/bin/rive'),'.','--commands=commands.txt'],cwd=r,capture_output=True,text=True,timeout=60)
  (r/'capture.log').write_text(result.stdout+result.stderr)
  if result.returncode or 'err ' in result.stdout:raise RuntimeError((result.stdout+result.stderr)[-4000:])
  for t in times:assert (r/'frames'/f'{t}.png').exists()
 finally:
  for binary in r.rglob('*.riv'):binary.unlink()
 (d/'todo.json').unlink(missing_ok=True)
 selected.append({'name':feature,'times':times,'threshold':16,'maxDiff':2,'maxOverPercent':0})
 print(feature,'captured')
manifest=json.loads((root/'cases.json').read_text());names={c['name'] for c in selected}
manifest=[c for c in manifest if c['name'] not in names]+selected
(root/'cases.json').write_text(json.dumps(manifest,indent=2)+'\n')

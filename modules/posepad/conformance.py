"""Author deterministic probes and independent affine expectations; no runtime imports."""
from pathlib import Path
import json
root = Path(__file__).resolve().parents[2]
def write(name, body, script, observations):
    d = root / 'spec/conformance' / name
    (d / 'case.animl').write_text(f'<anima version="0.1" name="{name}" grid="20" requires="posepad bind">\n{body}\n</anima>\n')
    (d / 'script.txt').write_text(script)
    (d / 'expected.jsonl').write_text(''.join(json.dumps({'time': t, 'values': v, 'states': s, 'events': [], 'settled': settled}, separators=(',', ':'))+'\n' for t,v,s,settled in observations))
    (d / 'todo.json').unlink(missing_ok=True)
art = '<circle id="eye" cx="10" cy="10" r="1" fill="#141413"/>'
timelines = '<timeline name="across" duration="2"><track target="eye.x">0 -4; 2 4</track></timeline>\n<timeline name="vertical" duration="4"><track target="eye.y">0 -8; 4 8</track></timeline>'
pad = '<posepad id="pad" timeline-x="across" timeline-y="vertical"/>'
pairs = [(-1,-1),(-.5,.25),(0,0),(.25,-.5),(1,1)]
write('animation-joystick-two-axis', '<number name="px"/><number name="py"/>\n'+art+pad+timelines+'\n<bind target="pad.value-x" value="px"/><bind target="pad.value-y" value="py"/>', ''.join(f'set px {x}\nset py {y}\nadvance 0\nsnapshot\n' for x,y in pairs), [(0, {'pad.valueX': x, 'pad.valueY': y, 'eye.x': 4*x, 'eye.y': 8*y}, {}, True) for x,y in pairs])
write('rigging-joystick', '<number name="px" default="1"/>\n'+art+pad+timelines+'\n<bind target="pad.value-x" value="px"/>\n<timeline name="drive" duration="2"><track target="pad.value-y">0 -1; 2 1</track></timeline>\n<layer name="l" initial="s"><state name="s" play="drive"/></layer>', 'advance 0\nsnapshot\nadvance 0.5\nsnapshot\nset px -0.5\nadvance 0.5\nsnapshot\nadvance 1\nsnapshot\n', [(t, {'pad.valueX': x, 'pad.valueY': y, 'eye.x': 4*x, 'eye.y': 8*y}, {'l': 's'}, t==2) for t,x,y in [(0,1,-1),(.5,1,-.5),(1,-.5,0),(2,-.5,1)]])
body = ''
for suffix,attrs in [('X','invert-x="true"'), ('Y','invert-y="true"')]:
    body += f'<circle id="eye{suffix}" cx="10" cy="10" r="1" fill="#141413"/>\n<posepad id="pad{suffix}" timeline-x="x{suffix}" timeline-y="y{suffix}" value-x="0.25" value-y="-0.5" {attrs}/>\n<timeline name="x{suffix}" duration="2"><track target="eye{suffix}.x">0 -4; 2 4</track></timeline>\n<timeline name="y{suffix}" duration="4"><track target="eye{suffix}.y">0 -8; 4 8</track></timeline>\n'
write('animation-joystick-invert', body, 'advance 0\nsnapshot\n', [(0, {'eyeX.x': -1, 'eyeX.y': -4, 'eyeY.x': 1, 'eyeY.y': 4}, {}, True)])
# Free handle evidence is in core/browser tests. Keep the designated combined probe pending.
d = root / 'spec/conformance/animation-joystick-handle'
(d/'case.animl').write_text((root/'modules/posepad/examples/look.animl').read_text())
(d/'script.txt').write_text('advance 0\npointer drag 10 15 14 11\nsnapshot\n')
(d/'todo.json').write_text(json.dumps({'status':'todo','reason':'Free pointer-drag handle is tested; distance-gated keepDistance probe awaits P8-1 merge and orchestrator rebase instruction.'},indent=2)+'\n')

# Use Anima's authoring formatter so generated probes are canonical corpus members.
import subprocess
for name in ['rigging-joystick','animation-joystick-two-axis','animation-joystick-invert']:
    subprocess.run(['node', 'packages/cli/src/main.ts', 'fmt', 'spec/conformance/'+name+'/case.animl', '--write'], cwd=root, check=True)

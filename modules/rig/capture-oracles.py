#!/usr/bin/env python3
"""Independently author native constraint probes, then capture with the local headless runner.
No native binary is read; generated binaries and build directories are removed in finally.
"""
import json, math, subprocess, shutil, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
INK='<Fill><SolidColor colorValue="FFd97757"/></Fill>'
def keys(id,prop,a,b):return f'<KeyedObject objectId="0:{id}"><KeyedProperty property="{prop}"><KeyFrameDouble frame="0" value="{a}" interpolationType="linear"/><KeyFrameDouble frame="60" value="{b}"/></KeyedProperty></KeyedObject>'
def circle(id,x,y,extra='',children='',r=.5):return f'<Shape id="0:{id}" x="{x*12}" y="{y*12}" {extra}>{children}<Ellipse width="{r*24}" height="{r*24}"/>{INK}</Shape>'
def mark(id,x=0,y=0,constraints='',extra=''):return f'<Shape id="0:{id}" x="{x*12}" y="{y*12}" {extra}>{constraints}<Rectangle x="12" y="0" width="24" height="12" originX="0" originY="0"/>{INK}</Shape>'
def node(id,x,y,extra=''):return f'<Node id="0:{id}" x="{x*12}" y="{y*12}" {extra}/>'
def acircle(id,x=0,y=0,children='',extra=''):return f'<group id="{id}" x="{x}" y="{y}" {extra}>{children}<circle id="{id}Art" cx="0" cy="0" r="0.5" fill="#d97757"/></group>'
def amark(id,x,y,children='',extra=''):return f'<group id="{id}" x="{x}" y="{y}" {extra}>{children}<rect id="{id}Art" x0="1" y0="0" width="2" height="1" fill="#d97757"/></group>'
def track(address,a,b):return f'<track target="{address}">0 {a}\n1 {b}</track>'
def save(name,ani,native,tracks,animation):
    name='rigging-'+name;directory=ROOT/'tests/oracle'/name;project=directory/'rive';(project/'frames').mkdir(parents=True,exist_ok=True)
    ani+=f'<timeline name="go" duration="1">{tracks}</timeline><layer name="main" initial="go"><state name="go" play="go"/></layer>'
    (directory/'case.animl').write_text(f'<anima version="0.1" name="{name}" grid="20" requires="rig">{ani}</anima>\n')
    machine='<LinearAnimation name="go" id="0:100" fps="60" duration="60" loopValue="oneShot">'+animation+'</LinearAnimation><StateMachine name="sm" id="0:101"><StateMachineLayer name="main"><EntryState><StateTransition stateToId="0:102"/></EntryState><AnimationState id="0:102" animationId="0:100"/></StateMachineLayer></StateMachine>'
    (project/'scene.rml').write_text('<Rive version="1" kind="fragment"><Artboard name="Oracle" id="0:1" width="240" height="240" styleId="0:2" defaultStateMachineId="0:101"><LayoutComponentStyle id="0:2"/><Fill><SolidColor colorValue="FFffffff"/></Fill>'+native+machine+'</Artboard></Rive>\n')
    (project/'rive.yaml').write_text('name: oracle-'+name+'\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
    (project/'commands.txt').write_text('screenshot frames/0.png\nadvance 500ms\nscreenshot frames/0.5.png\nadvance 501ms\nscreenshot frames/1.png\n')
    (directory/'todo.json').write_text(json.dumps({'status':'todo','reason':'Native references and raw measurements are supplied; orchestrator must classify differences and integrate fixed budgets.'},indent=2)+'\n')
    (project/'README.md').write_text('# Native probe\n\nIndependently authored by modules/rig/capture-oracles.py. Native rotations use radians and\nlengths use 12 px per grid unit. Rigid bone art is expressed in native bone-local space.\nThe last screenshot advances 1 ms beyond the once endpoint to avoid native float clock drift.\nNo binary is read or retained. Comparison budgets belong to the orchestrator.\n')
    if '--capture' in sys.argv:
        try:
            result=subprocess.run([str(Path.home()/'.rive/bin/rive'),'.','--commands=commands.txt'],cwd=project,text=True,capture_output=True,timeout=120)
            (project/'session.txt').write_text(result.stdout+result.stderr)
            if result.returncode or 'err ' in result.stdout or not all((project/'frames'/f'{t}.png').exists() for t in ['0','0.5','1']):raise RuntimeError(name+' capture failed: '+result.stdout+result.stderr)
            print(name,'captured',flush=True)
        finally:
            for binary in project.rglob('*.riv'):binary.unlink()
            shutil.rmtree(project/'build',ignore_errors=True)

# Bone art is converted by hand from authored rest grid positions into physical bone space.
ani='<bone id="upper" x="4" y="12" length="5"><bone id="fore" length="4"><circle id="hand" cx="13" cy="12" r="0.5" fill="#d97757"/></bone></bone>'
native='<RootBone id="0:10" x="48" y="144" length="60"><Bone id="0:11" length="48">'+circle(12,4,0)+'</Bone></RootBone>'
save('bone-chains',ani,native,track('upper.rotate',0,-60)+track('upper.length',5,6)+track('fore.rotate',0,30),keys(10,'rotation',0,-math.pi/3)+keys(10,'length',60,72)+keys(11,'rotation',0,math.pi/6))
ani='<bone id="outer" x="4" y="12" length="5"><bone id="inner" root="true" x="10" y="12" length="2"><circle id="hand" cx="12" cy="12" r="0.5" fill="#d97757"/></bone></bone>'
native='<RootBone id="0:10" x="48" y="144" length="60"><RootBone id="0:11" x="72" y="0" length="24">'+circle(12,2,0)+'</RootBone></RootBone>'
save('root-bones',ani,native,track('outer.rotate',0,-60)+track('inner.rotate',0,30),keys(10,'rotation',0,-math.pi/3)+keys(11,'rotation',0,math.pi/6))
ani='<group id="a" x="6" y="6"/><group id="b" x="14" y="8"/>'+acircle('ab',4,4,'<copy-position from="a"/><copy-position from="b"/>')+acircle('ba',4,4,'<copy-position from="b"/><copy-position from="a"/>')
native=node(10,6,6)+node(11,14,8)+circle(12,4,4,children='<TranslationConstraint targetId="0:10"/><TranslationConstraint targetId="0:11"/>')+circle(13,4,4,children='<TranslationConstraint targetId="0:11"/><TranslationConstraint targetId="0:10"/>')
save('constraint-order',ani,native,track('b.y',8,10),keys(11,'y',96,120))
ani='<group id="target" x="14" y="8"/>'+acircle('host',4,4,'<copy-position from="target" strength="0"/>')
native=node(10,14,8)+circle(11,4,4,children='<TranslationConstraint id="0:12" targetId="0:10" strength="0"/>')
save('constraint-strength',ani,native,track('host.constraints.0.strength',0,1),keys(12,'strength',0,1))
ani='<group id="target" x="2" y="8"/>'+acircle('host',12,4,'<copy-position from="target" factor-x="-1" copy-y="false" strength="0.5"/>')
native=node(10,2,8)+circle(11,12,4,children='<TranslationConstraint targetId="0:10" copyFactor="-1" doesCopyY="false" strength="0.5"/>')
save('translation',ani,native,track('target.x',2,4),keys(10,'x',24,48))
ani='<group id="target"/>'+amark('host',10,10,'<copy-rotation from="target" factor="-1" min="-45"/>')
native=node(10,0,0)+mark(11,10,10,'<RotationConstraint targetId="0:10" copyFactor="-1" min="true" minValue="'+str(-math.pi/4)+'"/>')
save('rotation',ani,native,track('target.rotate',0,90),keys(10,'rotation',0,math.pi/2))
ani='<group id="target" scaleX="1"/>'+amark('host',10,10,'<copy-scale from="target" factor-x="-1"/>')
native=node(10,0,0)+mark(11,10,10,'<ScaleConstraint targetId="0:10" copyFactor="-1"/>')
save('scale',ani,native,track('target.scaleX',1,2),keys(10,'scaleX',1,2))
ani='<group id="target" x="10" y="10"/>'+amark('host',2,4,'<copy-transform from="target"/>')
native=node(10,10,10)+mark(11,2,4,'<TransformConstraint targetId="0:10"/>')
save('transform',ani,native,track('target.rotate',0,90),keys(10,'rotation',0,math.pi/2))
for name,mode,nmode in [('closer','within','closer'),('further','beyond','further'),('exact','exact','exact')]:
    ani='<group id="target" x="5" y="10"/>';native=node(10,5,10);tracks='';animation=''
    for j,(id,x) in enumerate([('inside',6),('ring',8),('outside',11)]):
        ani+=acircle(id,x,10,f'<keep-distance to="target" distance="2" mode="{mode}"/>')
        native+=circle(20+j,x,10,children=f'<DistanceConstraint id="0:{30+j}" targetId="0:10" distance="24" modeValue="{nmode}"/>')
        tracks+=track(id+'.constraints.0.distance',2,4);animation+=keys(30+j,'distance',24,48)
    save('distance-'+name,ani,native,tracks,animation)

"""Independent paired interaction probes; local headless CLI only. No binary reads."""
import json
import subprocess
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
ORACLE = ROOT / 'tests/oracle'
CLI = str(Path.home() / '.rive/bin/rive')
MANIFEST = json.loads((ORACLE / 'cases.json').read_text())

def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)

def change(value):
    return f'<ListenerViewModelChange><BindablePropertyNumber propertyValue="{value}"><DataBindContext sourcePathIds="0:40-0:42" propertyKey="636" direction="true"/></BindablePropertyNumber></ListenerViewModelChange>'

def listener(target, kind, action, extra=''):
    return f'<StateMachineListener targetId="0:{target}" {extra}><ListenerInputType listenerTypeValue="{kind}"/>{action}</StateMachineListener>'

def keylistener(target, key, action, phase=1, mods=0, extra=''):
    return f'<StateMachineListener targetId="0:{target}" {extra}><ListenerInputTypeKeyboard listenerTypeValue="keyboard"><KeyboardInput keyType="{key}" keyPhase="{phase}" modifiers="{mods}"/></ListenerInputTypeKeyboard>{action}</StateMachineListener>'

def scene(nodes, listeners, initial=''):
    return f'''<Rive version="1" kind="fragment"><Artboard id="0:1" name="Interaction" width="240" height="240" defaultStateMachineId="0:10" viewModelId="0:40"><FocusData canFocus="false" edgeBehaviorValue="stop"/><Fill><SolidColor colorValue="FFFFFFFF"/></Fill>{nodes}<LinearAnimation id="0:4" name="idle" duration="60" fps="60"/><StateMachine id="0:10" name="interaction">{listeners}<StateMachineLayer><EntryState><StateTransition stateToId="0:12"/></EntryState><AnimationState id="0:12" animationId="0:4">{initial}</AnimationState></StateMachineLayer></StateMachine></Artboard><ViewModel id="0:40" name="Model" defaultInstanceId="0:41"><ViewModelPropertyNumber id="0:42" name="n"/><ViewModelInstance id="0:41" name="Default" exports="true"><ViewModelInstanceNumber viewModelPropertyId="0:42" propertyValue="0"/></ViewModelInstance></ViewModel></Rive>\n'''

def rect(i, x=40, y=100, focus='', extra=''):
    return f'<Shape id="0:{i}" name="item{i}" x="{x}" y="{y}" {extra}>{focus}<Rectangle width="24" height="24"/><Fill><SolidColor colorValue="FF4263EB"/></Fill></Shape>'

def capture(name, rml, commands, allow_errors=False):
    project = ORACLE / name / 'rive'
    stub = project / 'README.md'
    if stub.exists() and stub.read_text().startswith('TODO: independently author'):
        stub.unlink()
    write(project / 'scene.rml', rml)
    write(project / 'rive.yaml', 'name: interaction-oracle\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
    if name.startswith('input-cursor-'):
        write(project / 'rive.yaml', (project / 'rive.yaml').read_text() + 'cursor:\n  property: cursor\n')
    write(project / 'commands.txt', '\n'.join(commands) + '\n')
    (project / 'frames').mkdir(exist_ok=True)
    try:
        p = subprocess.run([CLI, '.', '--commands=commands.txt'], cwd=project, capture_output=True, text=True, timeout=60)
        write(project / 'session.txt', p.stdout + p.stderr)
        if not allow_errors and (p.returncode or 'err ' in p.stdout):
            raise RuntimeError(name + ': ' + p.stdout + p.stderr)
    finally:
        for binary in project.rglob('*.riv'):
            binary.unlink()

def pair(name, animl, rml, steps):
    # Each step is an independent observation after an equivalent command prefix.
    write(ORACLE / name / 'case.animl', animl + '\n')
    commands = ['advance 0', 'advance 0']
    scripts, times = {}, []
    script = 'advance 0\nadvance 0'
    for i, (native, anima) in enumerate(steps):
        commands += native + ['advance 0', f'data-dump frames/{i}.json', f'semantics frames/{i}.semantics.json']
        script += '\n' + anima + '\nadvance 0\nadvance 0'
        times.append(i)
        scripts[str(i)] = script
    capture(name, rml, commands)
    entry = dict(name=name, times=times, threshold=16, maxDiff=0, maxOverPercent=0,
                 scripts=scripts, values=dict(address='n', path='n', tolerance=0))
    if name.startswith('input-focus-') or name in ['input-listen-focus','input-listen-blur']: entry['focus'] = True
    global MANIFEST
    MANIFEST = [c for c in MANIFEST if c['name'] != name] + [entry]
    for marker in ['todo.json', 'skip.json']:
        (ORACLE / name / marker).unlink(missing_ok=True)
    (ORACLE / 'cases.json').write_text(json.dumps(MANIFEST, indent=2) + '\n')
    print(name, 'captured', flush=True)


def focus_probes():
    names = ['clear','down','edge-closed-loop','edge-parent-scope','edge-stop','enabled','left','next','previous','pointer','right','target','traverse','up']
    names += ['listen-focus','listen-blur']
    for kind in names:
        name = 'input-' + (kind if kind.startswith('listen-') else 'focus-' + kind)
        vertical = kind in ['up','down']
        edge = {'edge-closed-loop':'closedLoop','edge-parent-scope':'parentScope'}.get(kind, 'stop')
        aedge = {'closedLoop':'closed-loop','parentScope':'parent-scope','stop':'stop'}[edge]
        nodes, anodes, listeners = '', '', ''
        for j, label in enumerate('abc'):
            x, y = (100, 40 + j*80) if vertical else (40+j*80, 100)
            enabled = not (kind == 'enabled' and label == 'b')
            nodes += rect(20+j, x,y, f'<FocusData canFocus="{str(enabled).lower()}"/><SemanticData role="button" label="{label}"/>')
            anodes += f'<rect id="{label}" x="{x/12-1}" y="{y/12-1}" x0="0" y0="0" width="2" height="2" fill="#4263eb"><focus enabled="{str(enabled).lower()}" bounds="0 0 2 2"/></rect>'
            listeners += listener(20+j,'focus',change(j+1)) + listener(20+j,'blur',change(0))
        if kind.startswith('edge-'):
            # a,b inside scope; c outside. Leave b to test the enclosing edge policy.
            # Wrap first two shapes using independent authored hierarchy.
            split = nodes.index('<Shape id="0:22"')
            nodes = f'<Node id="0:6"><FocusData canFocus="false" edgeBehaviorValue="{edge}"/>' + nodes[:split] + '</Node>' + nodes[split:]
            split = anodes.index('<rect id="c"')
            anodes = f'<group id="scope"><focus enabled="false" scope="true" edge="{aedge}"/>' + anodes[:split] + '</group>' + anodes[split:]
        for key, direction in [('right','right'),('left','left'),('up','up'),('down','down'),('tab','next')]:
            listeners += keylistener(1,key,f'<FocusActionTraversal traversalKind="{direction}"/>')
        listeners += keylistener(1,'p','<FocusActionTraversal traversalKind="previous"/>')
        listeners += keylistener(1,'c','<FocusActionClear/>')
        listeners += keylistener(1,'t','<FocusActionTarget targetId="0:22"/>')
        listeners += keylistener(1,'a','<FocusActionTarget targetId="0:20"/>')
        for j in range(3):
            listeners += listener(20+j,'down',f'<FocusActionTarget targetId="0:{20+j}"/>')
        alisten = ''.join(f'<listener on="focus" target="{label}" set="n={j+1}"/><listener on="blur" target="{label}" set="n=0"/>' for j,label in enumerate('abc'))
        animl = f'<anima version="0.1" name="{name}" grid="20" requires="focus"><number name="n"/>{anodes}{alisten}</anima>'
        steps = [(['key t:down','key a:down'], 'focus target c\nadvance 0\nfocus target a')]
        if kind in ['clear','listen-blur']:
            steps += [(['key c:down'],'focus clear')]
        elif kind == 'target':
            steps += [(['key t:down'],'focus target c')]
        elif kind == 'pointer':
            steps += [(['pointer down@200,100'],'pointer down 16.666666666666668 8.333333333333334')]
        else:
            direction = {'previous':'previous','left':'left','up':'up','down':'down','right':'right'}.get(kind, 'next')
            if direction in ['previous','left','up']:
                steps += [(['key t:down'],'focus target c')]
            nativekey = {'next':'tab','previous':'p'}.get(direction,direction)
            steps += [([f'key {nativekey}:down'],f'focus traverse {direction}')]*3
        pair(name,animl,scene(nodes,listeners,'<FocusActionTarget targetId="0:20"/>'),steps)

def input_probes():
    def ani(name, nodes, listens, requires='input'):
        return f'<anima version="0.1" name="{name}" grid="20" requires="{requires}"><number name="n"/>{nodes}{listens}</anima>'
    arect = '<rect id="a" x0="2" y0="7" width="4" height="4" fill="#4263eb"/>'
    rrect = '<Shape id="0:20"><FocusData/><Rectangle x="24" y="84" width="48" height="48" originX="0" originY="0"/><Fill><SolidColor colorValue="FF4263EB"/></Fill></Shape>'
    for kind in ['down','filter','modifiers','repeat','up','board-bubble']:
        name = 'input-keyboard-bubbling' if kind == 'board-bubble' else 'input-key-'+kind
        phase = {'repeat':2,'up':4}.get(kind,1)
        akind = {'repeat':'repeat','up':'up'}.get(kind,'down')
        mods = 3 if kind == 'modifiers' else 0
        amods = 'shift+control' if mods else '-'
        nkmods = '+shift+ctrl' if mods else ''
        action = change(1)
        ls = keylistener(20,'f13',action,phase,mods)
        als = f'<listener on="key-{akind}" target="a" key="F13" modifiers="{amods if mods else ""}" set="n=1"/>'
        if kind == 'board-bubble':
            ls += keylistener(1,'any',change(2),phase)
            als += '<listener on="key-down" set="n=2"/>'
        steps = [([],''),([f'key f12:{akind}{nkmods}'],f'key {akind} F12 {amods} a'),([f'key f13:{akind}{nkmods}'],f'key {akind} F13 {amods} a')]
        if mods:
            steps += [(['data n=0','key f13:down+shift+ctrl+alt'],'set n 0\nkey down F13 shift+control+alt a')]
        pair(name,ani(name,arect,als),scene(rrect,ls,'<FocusActionTarget targetId="0:20"/>'),steps)
    for kind in ['axis','button','button-phases','connected','disconnected']:
        name = 'input-gamepad-'+kind
        rkind = kind.split('-')[0]
        inputvalue = 'gamepadChangedValue' if rkind in ['axis','button'] else 'none'
        act = change(1).replace('<ListenerViewModelChange>',f'<ListenerViewModelChange inputValue="{inputvalue}">')
        phase = 2 if kind == 'button-phases' else 3
        ls = f'<StateMachineListener targetId="0:20"><ListenerInputTypeGamepad listenerTypeValue="gamepad"><GamepadInput kind="{rkind}" inputIndex="0" buttonPhase="{phase}"/></ListenerInputTypeGamepad>{act}</StateMachineListener>'
        als = f'<listener on="gamepad-{rkind}" control="0" '+('phase="release" ' if kind=='button-phases' else '')+('write=\'{"value":"n"}\'' if rkind in ['axis','button'] else 'set="n=1"')+'/>'
        steps = [([],''),(['gamepad connect'],'gamepads [{"index":0,"connected":true,"mapping":"standard"}]')]
        if rkind == 'axis':
            steps += [(['gamepad axis@0:-0.25'],'gamepads [{"index":0,"connected":true,"mapping":"standard","axes":[-0.25]}]'),(['gamepad axis@0:0.5'],'gamepads [{"index":0,"connected":true,"mapping":"standard","axes":[0.5]}]')]
        elif rkind == 'button':
            steps += [(['gamepad button@0:0.75'],'gamepads [{"index":0,"connected":true,"buttons":[{"value":0.75,"pressed":true}]}]'),(['gamepad button@0:up'],'gamepads [{"index":0,"connected":true,"buttons":[{"value":0,"pressed":false}]}]')]
        elif rkind == 'disconnected':
            steps += [(['gamepad disconnect'],'gamepads [{"index":0,"connected":false}]')]
        pair(name,ani(name,arect,als),scene(rrect,ls,'<FocusActionTarget targetId="0:20"/>'),steps)
    for name in ['host-api-low-level-pointer','host-api-multitouch','input-multi-touch','input-hit-shape-geometry','input-bounded-hit-tests','input-hit-test-host','host-api-pointer-exit','input-hit-parent-chain']:
        shape = '<circle id="a" cx="10" cy="10" r="5" fill="#4263eb"/>'
        native = '<Shape id="0:20"><Ellipse x="120" y="120" width="120" height="120"/><Fill><SolidColor colorValue="FF4263EB"/></Fill></Shape>'
        ls = listener(20,'down',change(1)) + listener(20,'up',change(2))
        als = '<listener on="down" target="a" set="n=1"/><listener on="up" target="a" set="n=2"/>'
        steps = [([],''),(['pointer down@174,174'],'contact down 0 14.5 14.5'),(['pointer down@120,120'],'contact down 0 10 10'),(['pointer up@120,120'],'contact up 0 10 10')]
        if name in ['host-api-multitouch','input-multi-touch']:
            # Independent IDs keep the first press alive while the other is released.
            steps = [([],''),(['touch down:7@120,120'],'contact down 7 10 10'),(['touch down:8@120,120'],'contact down 8 10 10'),(['touch up:8@120,120'],'contact up 8 10 10'),(['data n=0','touch up:7@120,120'],'set n 0\ncontact up 7 10 10')]
        if name == 'host-api-low-level-pointer':
            ls = listener(20,'down',change(0).replace('<ListenerViewModelChange>','<ListenerViewModelChange inputValue="pointerX">'))
            als = '<listener on="down" target="a" write=\'{"x":"n"}\'/>'
            # Native coordinate value is pixels; use the same 240-unit document here.
            shape = '<circle id="a" cx="120" cy="120" r="60" fill="#4263eb"/>'
            steps = [([],''),(['pointer down@108,120'],'contact down 0 108 120'),(['pointer down@144,120'],'contact down 0 144 120')]
        if name == 'host-api-pointer-exit':
            ls = listener(20,'enter',change(1))+listener(20,'exit',change(2))
            als = '<listener on="enter" target="a" set="n=1"/><listener on="leave" target="a" set="n=2"/>'
            steps = [([],''),(['pointer move@120,120'],'contact move 0 10 10'),(['pointer exit@120,120'],'contact leave 0')]
        if name == 'input-hit-parent-chain':
            shape = '<group id="parent">'+shape+'</group>'
            native = '<Node id="0:6">'+native+'</Node>'
            ls = listener(6,'down',change(1))
            als = '<listener on="down" target="parent" set="n=1"/>'
            steps = steps[:3]
        doc = ani(name,shape,als)
        if name == 'host-api-low-level-pointer': doc = doc.replace('grid="20"','grid="240"')
        pair(name,doc,scene(native,ls),steps)

def additional_probes():
    for kind in ['preserve','snap']:
        name = 'input-align-'+kind
        native = rect(20,80,100, '<DataBindContext sourcePathIds="0:40-0:42" propertyKey="13" direction="true"/>')
        ls = listener(20,'drag',f'<ListenerAlignTarget targetId="0:20" preserveOffset="{str(kind=="preserve").lower()}"/>')
        animl = f'''<anima version="0.1" name="{name}" grid="240" requires="input"><number name="n" default="80"/><rect id="a" x="80" y="100" x0="-12" y0="-12" width="24" height="24" fill="#4263eb"/><listener on="drag" target="a" align="{kind}" write='{{"x":"n"}}'/></anima>'''
        steps = [([],''),(['pointer down@88,100'],'contact down 0 88 100'),(['pointer move@104,112'],'contact move 0 104 112'),(['pointer up@104,112'],'contact up 0 104 112')]
        pair(name,animl,scene(native,ls),steps)
    for name in ['input-opaque-targets','input-hit-occlusion-query']:
        native = rect(21,120,120,extra='isTargetOpaque="true"')+rect(20,120,120)
        # Both probes include a visible opaque blocker with its own listener.
        ls = listener(20,'down',change(1))+listener(21,'down',change(2))
        animl = f'''<anima version="0.1" name="{name}" grid="240" requires="input"><number name="n"/><rect id="a" x0="108" y0="108" width="24" height="24" fill="#4263eb"/><rect id="top" x0="108" y0="108" width="24" height="24" fill="#4263eb" opaque="true"/><listener on="down" target="a" set="n=1"/><listener on="down" target="top" set="n=2"/></anima>'''
        pair(name,animl,scene(native,ls),[([],''),(['pointer down@120,120'],'contact down 0 120 120')])
    for kind in ['collapse','solo']:
        name='transforms-'+kind
        native = '<Solo id="0:6" '+('activeComponentId="0:22"' if kind=='solo' else '')+'>'+rect(20,60,120)+rect(22,180,120)+'</Solo>'
        ls = listener(20,'down',change(1))+listener(22,'down',change(2))
        nodes = f'<group id="parent" {"solo="+chr(34)+"1"+chr(34) if kind=="solo" else "collapsed="+chr(34)+"true"+chr(34)}><rect id="a" x0="48" y0="108" width="24" height="24" fill="#4263eb"/><rect id="b" x0="168" y0="108" width="24" height="24" fill="#4263eb"/></group>'
        animl=f'<anima version="0.1" name="{name}" grid="240" requires="input"><number name="n"/>{nodes}<listener on="down" target="a" set="n=1"/><listener on="down" target="b" set="n=2"/></anima>'
        pair(name,animl,scene(native,ls),[([],''),(['pointer down@60,120'],'contact down 0 60 120'),(['pointer down@180,120'],'contact down 0 180 120')])
        project=ORACLE/name/'rive'
        commands=(project/'commands.txt').read_text().splitlines()+['screenshot frames/0.png']
        capture(name,scene(native,ls),commands)
        rendername=name+'-render'
        import shutil
        shutil.copytree(ORACLE/name,ORACLE/rendername,dirs_exist_ok=True)
        (ORACLE/rendername/'rive/README.md').unlink(missing_ok=True)
        entry=dict(name=rendername,times=[0],threshold=16,maxDiff=2,maxOverPercent=0)
        global MANIFEST
        MANIFEST=[c for c in MANIFEST if c['name']!=rendername]+[entry]
        (ORACLE/'cases.json').write_text(json.dumps(MANIFEST,indent=2)+'\n')

def final_probes():
    name='input-capture-phase'
    native='<Node id="0:6">'+rect(20,120,120)+'</Node>'
    ls=listener(20,'down',change(3))+listener(6,'down',change(1),'phaseValue="capture"')+listener(20,'down',change(2),'phaseValue="capture"')
    animl='''<anima version="0.1" name="input-capture-phase" grid="240" requires="input"><number name="n"/><group id="parent"><rect id="a" x0="108" y0="108" width="24" height="24" fill="#4263eb"/></group><listener on="down" target="a" set="n=3"/><listener on="down" target="parent" capture="true" consume="true" set="n=1"/><listener on="down" target="a" capture="true" consume="true" set="n=2"/></anima>'''
    pair(name,animl,scene(native,ls),[([],''),(['pointer down@120,120'],'contact down 0 120 120')])
    name='input-multi-trigger-listener'
    native=rect(20,120,120,'<FocusData/>')
    ls='<StateMachineListener targetId="0:20"><ListenerInputType listenerTypeValue="down"/><ListenerInputType listenerTypeValue="up"/><ListenerInputTypeKeyboard listenerTypeValue="keyboard"><KeyboardInput keyType="a" keyPhase="1"/></ListenerInputTypeKeyboard>'+change(1)+'</StateMachineListener>'
    animl='''<anima version="0.1" name="input-multi-trigger-listener" grid="240" requires="input"><number name="n"/><rect id="a" x0="108" y0="108" width="24" height="24" fill="#4263eb"/><listener on="down|up|key-down" target="a" key="a" set="n=1"/></anima>'''
    steps=[([],''),(['pointer down@120,120'],'contact down 0 120 120'),(['data n=0','pointer up@120,120'],'set n 0\ncontact up 0 120 120'),(['data n=0','key a:down'],'set n 0\nkey down a - a')]
    pair(name,animl,scene(native,ls,'<FocusActionTarget targetId="0:20"/>'),steps)
    for name in ['input-wheel-scroll','input-trackpad-scroll','host-api-low-level-scroll','host-api-scroll-latching']:
        native='''<LayoutComponent id="0:60" width="240" height="200" clip="true" styleId="0:61"><LayoutComponentStyle id="0:61" layoutWidthScaleType="fixed" layoutHeightScaleType="fixed" flexDirectionValue="column"/><LayoutComponent id="0:62" width="240" styleId="0:63"><LayoutComponentStyle id="0:63" layoutWidthScaleType="fixed" layoutHeightScaleType="hug" flexDirectionValue="column"/><ScrollConstraint id="0:64" directionValue="vertical" physicsTypeValue="clamped"><DataBindContext sourcePathIds="0:40-0:42" propertyKey="760" direction="true"/></ScrollConstraint><LayoutComponent width="240" height="600" styleId="0:65"><LayoutComponentStyle id="0:65" layoutWidthScaleType="fixed" layoutHeightScaleType="fixed"/><Fill><SolidColor colorValue="FF4263EB"/></Fill></LayoutComponent></LayoutComponent></LayoutComponent>'''
        animl=f'''<anima version="0.1" name="{name}" grid="240" requires="input"><number name="n"/><rect id="a" x0="0" y0="0" width="240" height="200" fill="#4263eb"/><listener on="scroll" target="a" write='{{"deltaY":"n"}}'/></anima>'''
        gesture='trackpad' if name=='input-trackpad-scroll' else 'wheel'
        steps=[([],''),([f'pointer {gesture}@120,100:0,-24:1'],'scroll 120 100 0 -24 start 0')]
        pair(name,animl,scene(native,''),steps)

def limit_probes():
    limits = {
        'input-button-middle': ('middle', ['pointer down:middle@120,120','pointer down@120,120:middle','pointer down@120,120,1','pointer middle@120,120'], 'The scene has a native middle-button filter. The runner rejects button selectors; its accepted down injects primary only. A zero middle response is not a successful button comparison.'),
        'input-button-secondary': ('secondary', ['pointer down:secondary@120,120','pointer down@120,120:secondary','pointer down@120,120,2','pointer secondary@120,120'], 'The scene has a native secondary-button filter. The runner rejects button selectors; its accepted down injects primary only. A zero secondary response is not a successful button comparison.'),
        'input-pointer-cancel': ('primary', ['pointer cancel@120,120','touch cancel:7@120,120'], 'The runner can lift or exit a contact, but rejects cancel for mouse and touch. Exit is a different Anima phase and cannot verify pointer cancellation.'),
        'input-pointer-enable': ('primary', ['pointer-enable 7 false','pointer enable:7@120,120'], 'Per-contact enablement is an Anima host controller operation. The runner rejects the enable operation and exposes no equivalent per-contact gate. Ordinary scene visibility is not per-ID suppression.'),
        'input-gamepad-index-mapping': ('primary', ['gamepad connect:2','gamepad axis@1:-0.25:2','gamepad mapping=raw'], 'The runner accepts one synthetic standard pad and control indices, but rejects pad index and mapping selection. This does not establish filtering among multiple device indices or a raw mapping.'),
        'host-api-scroll-latching': ('primary', ['pointer scroll@120,100:0,-24:start:0','scroll 120 100 0 -24 move 0.1'], 'Wheel/trackpad gestures scroll the native scene, but raw scroll phases and caller timestamps are not command-runner operations. The Anima 0.15-second latch expiry cannot be compared by isolated completed wheel gestures.'),
    }
    global MANIFEST
    for name,(button, rejected, reason) in limits.items():
        ls=f'<StateMachineListener targetId="0:20"><ListenerInputTypePointerButton listenerTypeValue="down" pointerButtonValue="{button}"/>'+change(1)+'</StateMachineListener>'
        rml=scene(rect(20,120,120,'<FocusData/><SemanticData role="button" label="probe"/>'),ls,'<FocusActionTarget targetId="0:20"/>')
        if name=='host-api-scroll-latching': rml=(ORACLE/name/'rive/scene.rml').read_text()
        commands=['advance 0','advance 0','data-dump frames/0.json','semantics frames/0.semantics.json','pointer down@120,120']+rejected+['gamepad connect','gamepad axis@1:-0.25','pointer wheel@120,100:0,-24:1','advance 0','data-dump frames/1.json','semantics frames/1.semantics.json','screenshot frames/limit.png']
        capture(name,rml,commands,allow_errors=True)
        log=(ORACLE/name/'rive/session.txt').read_text()
        assert 'err ' in log, name
        MANIFEST=[c for c in MANIFEST if c['name']!=name]
        (ORACLE/name/'todo.json').unlink(missing_ok=True)
        skip=dict(status='skip',reason=reason,captureEvidence=[f'tests/oracle/{name}/rive/{f}' for f in ['scene.rml','commands.txt','session.txt','frames/0.json','frames/1.json','frames/1.semantics.json','frames/limit.png']],tests=['modules/input/test/core/runtime.test.ts','modules/input/test/web/runtime.test.ts'])
        # The canonical browser suite name is checked rather than guessed.
        skip['tests']=['modules/input/test/core/runtime.test.ts']
        write(ORACLE/name/'skip.json',json.dumps(skip,indent=2)+'\n')
        print(name,'limit captured',flush=True)
    (ORACLE/'cases.json').write_text(json.dumps(MANIFEST,indent=2)+'\n')

def finalize_findings():
    global MANIFEST
    reasons = {
        'input-align-preserve': ('Intentional difference: Anima follows the pointer with the grab offset measured at pointer-down (x=88 on origin x=80; move to x=104 yields x=96). Native preserve-offset remains x=80 at the first move and after release; absolute delta 16. Neither result nor tolerance is normalized.', [(2,96,80,16),(3,96,80,16)]),
    }
    for name,(reason,observations) in reasons.items():
        entry=next((c for c in MANIFEST if c['name']==name),None)
        if entry:
            write(ORACLE/name/'finding.json',json.dumps(dict(status='intentional difference',reason=reason,case=entry,observations=[dict(time=t,actual=a,reference=r,delta=d) for t,a,r,d in observations]),indent=2)+'\n')
            MANIFEST=[c for c in MANIFEST if c['name']!=name]
    (ORACLE/'cases.json').write_text(json.dumps(MANIFEST,indent=2)+'\n')

def cursor_probes():
    global MANIFEST
    for kind in ['arrow','hidden','intent','pointer','resize-horizontal','resize-vertical','text']:
        name='input-cursor-'+kind
        intent='pointer' if kind=='intent' else kind
        def request(value):
            return '<ListenerViewModelChange><BindablePropertyString propertyValue="'+value+'"><DataBindContext sourcePathIds="0:40-0:42" propertyKey="635" direction="true"/></BindablePropertyString></ListenerViewModelChange>'
        native=rect(20,120,120)
        ls=listener(20,'enter',request(intent))+listener(20,'exit',request(''))
        rml=scene(native,ls).replace('ViewModelPropertyNumber','ViewModelPropertyString').replace('ViewModelInstanceNumber','ViewModelInstanceString').replace('name="n"','name="cursor"').replace('propertyValue="0"','propertyValue=""')
        animl=f'<anima version="0.1" name="{name}" grid="240" requires="input"><rect id="a" x0="108" y0="108" width="24" height="24" fill="#4263eb" cursor="{intent}"/></anima>'
        steps=[([],''),(['pointer move@120,120'],'contact move 0 120 120'),(['pointer move@20,20'],'contact move 0 20 20')]
        pair(name,animl,rml,steps)
        entry=next(c for c in MANIFEST if c['name']==name)
        entry['values']=dict(address='@cursor',path='cursor',tolerance=0)
        (ORACLE/'cases.json').write_text(json.dumps(MANIFEST,indent=2)+'\n')
        write(ORACLE/name/'rive/rive.yaml','name: interaction-oracle\ncursor:\n  property: cursor\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
        capture(name,rml,(ORACLE/name/'rive/commands.txt').read_text().splitlines())


def host_limit_probes():
    limits={
        'host-api-coordinate-mapping':('dom getScreenCTM','Browser SVG/CSS coordinate inversion is unavailable in a headless artboard. Pointer coordinates reach the scene, but no host DOM matrix exists to inspect.'),
        'host-api-dom-listener-control':('dom removeEventListener pointerdown','The native runner dispatches input directly and exposes no browser add/removeEventListener lifecycle. Manual dispatch is observable, DOM handler teardown is not.'),
        'input-disable-listeners':('dom listeners false','Browser automatic DOM listener enablement is not a native runner operation. Direct injected input still reaches the scene; this cannot establish DOM listener removal.'),
        'host-api-gamepad':('navigator getGamepads','Synthetic native gamepad injection works, but browser navigator.getGamepads polling, focus gating and teardown have no host in this runner.'),
        'input-gamepad-host':('navigator getGamepads','Synthetic gamepad events are observable; browser polling and visibility/focus gating require navigator and a DOM host, which the native runner does not provide.'),
        'host-api-manual-gamepad-batch':('gamepads [{"index":0,"connected":true},{"index":-1,"connected":true}]','Native single-pad injection exposes no validated atomic batch or rollback on a bad later record. This row concerns a host batch API rather than synthetic control delivery.'),
        'host-api-scroll-hit-policy':('dom defaultPrevented','The runner can inject wheel input, but no surrounding browser page or WheelEvent.defaultPrevented is exposed. Native scroll output cannot establish prevention of page scrolling.'),
        'input-touch-page-scroll':('dom touch-action','Native multi-finger input works; an enclosing HTML page and its touch-action/page-scroll behavior do not exist in this runner.'),
    }
    for name,(unsupported,reason) in limits.items():
        rml=scene(rect(20,120,120,'<FocusData/><SemanticData role="button" label="probe"/>'),listener(20,'down',change(1)),'<FocusActionTarget targetId="0:20"/>')
        commands=['advance 0','pointer down@120,120','gamepad connect','gamepad axis@0:0.5','touch down:7@120,120',unsupported,'advance 0','data-dump frames/0.json','semantics frames/0.semantics.json','screenshot frames/limit.png']
        capture(name,rml,commands,allow_errors=True)
        assert 'err ' in (ORACLE/name/'rive/session.txt').read_text()
        skip=dict(status='skip',reason=reason,captureEvidence=[f'tests/oracle/{name}/rive/{f}' for f in ['scene.rml','commands.txt','session.txt','frames/0.json','frames/0.semantics.json','frames/limit.png']],tests=['modules/input/test/core/runtime.test.ts','modules/input/test/web/browser.test.ts'])
        write(ORACLE/name/'skip.json',json.dumps(skip,indent=2)+'\n')
        print(name,'host limit captured',flush=True)

if __name__ == '__main__':
    import sys
    if '--all' in sys.argv:
        focus_probes()
        input_probes()
        additional_probes()
        final_probes()
        limit_probes()
        cursor_probes()
        host_limit_probes()
    elif '--input' in sys.argv: input_probes()
    elif '--additional' in sys.argv: additional_probes()
    elif '--final' in sys.argv: final_probes()
    elif '--limits' in sys.argv: limit_probes()
    elif '--cursor' in sys.argv: cursor_probes()
    elif '--host-limits' in sys.argv: host_limit_probes()
    elif '--classify' not in sys.argv: focus_probes()
    finalize_findings()

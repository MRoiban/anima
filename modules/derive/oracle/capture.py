"""Independent RML/AniML probes. Run from repo root with --capture to refresh native dumps.

Only local headless --commands is invoked. No binary output is read. The reference
projection copies typed values from dumps; it never evaluates Anima expressions.
"""
import argparse
import json
from pathlib import Path
import subprocess
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[3]
ORACLE = ROOT / 'tests/oracle'
RIVE = Path.home() / '.rive/bin/rive'


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip('\n') + '\n')


def bind(path, key, **attrs):
    extra = ''.join(f' {k}="{v}"' for k, v in attrs.items())
    return f'<DataBindContext sourcePathIds="{path}" propertyKey="{key}"{extra}/>'


def condition(prop, kind, op, rhs):
    key = 636 if kind == 'Number' else 634
    left = f'<TransitionPropertyViewModelComparator><BindableProperty{kind}>{bind("0:40-0:"+str(prop), key)}</BindableProperty{kind}></TransitionPropertyViewModelComparator>'
    if isinstance(rhs, tuple):
        right = f'<TransitionPropertyViewModelComparator><BindableProperty{kind}>{bind("0:40-0:"+str(rhs[0]), key)}</BindableProperty{kind}></TransitionPropertyViewModelComparator>'
    else:
        right = f'<TransitionValue{kind}Comparator value="{str(rhs).lower()}"/>'
    return f'<TransitionViewModelCondition opValue="{op}">{left}{right}</TransitionViewModelCondition>'


def shell_scene(content, roots):
    return f'<Rive version="1" kind="fragment">{content}{roots}</Rive>'


def capture(directory):
    rive = directory / 'rive'
    result = subprocess.run([str(RIVE), str(rive.relative_to(ROOT)), '--commands='+str((rive/'commands.txt').relative_to(ROOT))], cwd=ROOT, text=True, capture_output=True)
    write(rive/'session.txt', result.stdout + result.stderr)
    # A local command may produce a binary build; delete without opening it.
    for p in rive.rglob('*.riv'):
        p.unlink()
    if result.returncode or 'err ' in result.stdout:
        raise RuntimeError(result.stdout + result.stderr)


def setup(name, animl, rml, commands):
    d = ORACLE / name
    write(d/'case.animl', animl)
    write(d/'rive/scene.rml', rml)
    write(d/'rive/rive.yaml', 'name: '+name)
    (d/'rive/frames').mkdir(parents=True, exist_ok=True)
    write(d/'rive/commands.txt', '\n'.join(commands+['quit']))
    return d


def dump_command(name, index):
    return f'data-dump tests/oracle/{name}/rive/frames/{index}.json'


def project(d, addresses, paths, count):
    def find(value, path):
        if isinstance(value, dict):
            if value.get('path') == path:
                return [value['value']]
            return sum((find(v, path) for v in value.values()), [])
        if isinstance(value, list):
            return sum((find(v, path) for v in value), [])
        return []
    observations = []
    for i in range(count):
        raw = json.loads((d/f'rive/frames/{i}.json').read_text())
        values = {}
        for address, path in zip(addresses, paths):
            matches = find(raw['viewModel'], path)
            if len(matches) != 1:
                raise ValueError((path, matches))
            values[address] = matches[0]
        observations.append(dict(click=i, values=values, events=[]))
    write(d/'rive/observations.json', json.dumps(observations, indent=2))


def comparison_cases(do_capture):
    expressions = {'lt': '$left < $right', 'le': '$left <= $right', 'eq': '$left == $right', 'ne': '$left != $right', 'and': '$a and $b', 'or': '$a or $b', 'not': 'not $a'}
    operators = {'lt': ('lessThan', 'greaterThanOrEqual'), 'le': ('lessThanOrEqual', 'greaterThan'), 'eq': ('equal', 'notEqual'), 'ne': ('notEqual', 'equal')}
    # Equal, below, above, negative, fractional and changed RHS; full boolean table, repeated transitions.
    samples = [(0,0,False,False),(-1,0,False,True),(1,0,True,False),(0,0,True,True),(0,1,False,False),(1,1,True,False),(-0.5,-0.25,False,True),(2,1,True,True),(0,0,False,False)]
    names = []
    for op, expression in expressions.items():
        name = 'bind-logic-'+op
        names.append(name)
        def groups(truth):
            if op in operators:
                return [[condition(42, 'Number', operators[op][0 if truth else 1], (43,))]]
            a = condition(44, 'Boolean', 'equal', truth)
            b = condition(45, 'Boolean', 'equal', truth)
            if op == 'not':
                return [[condition(44, 'Boolean', 'equal', not truth)]]
            return [[a,b]] if (op == 'and') == truth else [[a],[b]]
        def transitions(truth):
            return ''.join(f'<StateTransition stateToId="0:{102 if truth else 103}" duration="0">'+''.join(g)+'</StateTransition>' for g in groups(truth))
        custom = '<Event name="observation">'+''.join(f'<CustomProperty{kind} id="0:{oid}" name="{field}">{bind("0:40-0:"+str(pid), key, direction="true")}</CustomProperty{kind}>' for kind,oid,pid,key,field in [('Number',10,46,243,'number'),('Boolean',11,47,245,'bool')])+'</Event>'
        animations = ''.join(f'<LinearAnimation id="0:{aid}" name="{label}" duration="60" fps="60">'+''.join(f'<KeyedObject objectId="0:{oid}"><KeyedProperty property="propertyValue"><{kf} frame="0" value="{value}"/></KeyedProperty></KeyedObject>' for oid,kf,value in [(10,'KeyFrameDouble',str(n)),(11,'KeyFrameBool',str(bool(n)).lower())])+'</LinearAnimation>' for aid,label,n in [(100,'true',1),(110,'false',0)])
        machine = f'<StateMachine id="0:101" name="run"><StateMachineLayer><EntryState><StateTransition stateToId="0:103"/></EntryState><AnimationState id="0:102" animationId="0:100">{transitions(False)}</AnimationState><AnimationState id="0:103" animationId="0:110">{transitions(True)}</AnimationState></StateMachineLayer></StateMachine>'
        props = [(42,'Number','left',0),(43,'Number','right',0),(44,'Boolean','a','false'),(45,'Boolean','b','false'),(46,'Number','resultNumber',0),(47,'Boolean','resultBool','false')]
        roots = '<ViewModel id="0:40" name="Root" defaultInstanceId="0:41">'+''.join(f'<ViewModelProperty{kind} id="0:{pid}" name="{field}"/>' for pid,kind,field,_ in props)+'<ViewModelInstance id="0:41" name="main">'+''.join(f'<ViewModelInstance{kind} viewModelPropertyId="0:{pid}" propertyValue="{value}"/>' for pid,kind,_,value in props)+'</ViewModelInstance></ViewModel>'
        rml = shell_scene(f'<Artboard id="0:1" name="Probe" width="20" height="20" viewModelId="0:40" defaultStateMachineId="0:101">{custom}{animations}{machine}</Artboard>', roots)
        animl = '<anima version="0.1" name="'+name+'" grid="20" requires="data bind"><model name="Root"><number name="left"/><number name="right"/><bool name="a"/><bool name="b"/></model><circle id="dot" cx="10" cy="10" r="1" fill="#000" properties="{&quot;number&quot;:{&quot;type&quot;:&quot;number&quot;},&quot;bool&quot;:{&quot;type&quot;:&quot;bool&quot;}}"/>'+''.join(f'<bind target="dot.properties.{field}" value="{escape(expression)}"/>' for field in ['number','bool'])+'</anima>'
        commands, script = ['advance 0'], []
        for i, sample in enumerate(samples):
            for field, value in zip(['left','right','a','b'], sample):
                v = str(value).lower()
                commands.append(f'data {field}={v}')
                script.append(f'set ${field} {v}')
            commands += ['advance 2', dump_command(name,i)]
            script += ['advance 0', 'snapshot dot.properties.number dot.properties.bool']
        d = setup(name,animl,rml,commands)
        write(d/'script.txt','\n'.join(script))
        if do_capture:
            capture(d)
            project(d,['dot.properties.number','dot.properties.bool'],['resultNumber','resultBool'],len(samples))
    return names



def derive_cases(do_capture):
    name = 'derive-score-label'
    # A scene custom property bridges a converter result back into model storage.
    source = '0:40-0:44'
    custom = '<Event name="observation"><CustomPropertyString name="label">'+bind(source,246,converterId='0:80')+bind('0:40-0:43',246,direction='true')+'</CustomPropertyString></Event>'
    custom += '<Event name="bounded-observation"><CustomPropertyNumber name="bounded">'+bind('0:40-0:42',243,converterId='0:90')+bind('0:40-0:45',243,direction='true')+'</CustomPropertyNumber></Event>'
    idle = '<LinearAnimation id="0:100" name="idle" duration="60" fps="60"/><StateMachine id="0:101" name="run"><StateMachineLayer><EntryState><StateTransition stateToId="0:102"/></EntryState><AnimationState id="0:102" animationId="0:100"/></StateMachineLayer></StateMachine>'
    props = '<ViewModelPropertyNumber id="0:42" name="score"/><ViewModelPropertyString id="0:43" name="label"/><ViewModelPropertyString id="0:44" name="template"/>'
    props += '<ViewModelPropertyNumber id="0:45" name="bounded"/>'
    def values(score):
        return f'<ViewModelInstanceNumber viewModelPropertyId="0:45" propertyValue="0"/><ViewModelInstanceNumber viewModelPropertyId="0:42" propertyValue="{score}"/><ViewModelInstanceString viewModelPropertyId="0:43" propertyValue=""/><ViewModelInstanceString viewModelPropertyId="0:44" propertyValue="${{score:,.0f}} pts"/>'
    converter = '<DataConverterStringTemplate id="0:80"><StringTemplateArgumentNumber name="score" order="a0">'+bind('0:40-0:42',483)+'</StringTemplateArgumentNumber></DataConverterStringTemplate>'
    converter += '<DataConverterFormula id="0:90"><FormulaTokenFunction functionType="0"/><FormulaTokenValue operationValue="20"/><FormulaTokenArgumentSeparator/><FormulaTokenFunction functionType="1"/><FormulaTokenValue operationValue="10"/><FormulaTokenArgumentSeparator/><FormulaTokenInput/><FormulaTokenOperation operationType="3"/><FormulaTokenValue operationValue="100"/><FormulaTokenParenthesisClose/><FormulaTokenParenthesisClose/></DataConverterFormula>'
    root = '<ViewModel id="0:40" name="Player" defaultInstanceId="0:41">'+props+'<ViewModelInstance id="0:41" name="main" exports="true">'+values(1250)+'</ViewModelInstance></ViewModel>'+converter
    scalar_rml = shell_scene('<Artboard id="0:1" name="Probe" width="20" height="20" viewModelId="0:40" defaultStateMachineId="0:101">'+custom+idle+'</Artboard>',root)
    animl = '<anima version="0.1" name="'+name+'" grid="20" requires="data bind derive convert"><model name="Player"><number name="score" default="1250"/><string name="label" value="$score" convert="points"/><number name="bounded" min="10" max="20" value="$score / 100"/></model><converter name="grouped" type="number-format" decimals="0" grouping="true"/><converter name="suffix" type="template" text="{0} pts"/><converter-group name="points" chain="grouped suffix"/><circle id="dot" cx="10" cy="10" r="1" fill="#000"/></anima>'
    scores = [1250,980,40,1500,0,2000,2500,1250]
    commands,script = ['advance 0'],[]
    for i,score in enumerate(scores):
        commands += [f'data score={score}', 'advance 1', dump_command(name,i)]
        script += [f'set $score {score}','advance 0','snapshot $score $label $bounded']
    commands += ['data label=manual',dump_command(name,'write'),'advance 1',dump_command(name,'write-settled'),'data score=1501','advance 1',dump_command(name,'source-after-write')]
    d=setup(name,animl,scalar_rml,commands)
    write(d/'script.txt','\n'.join(script))
    if do_capture:
        capture(d)
        project(d,['$score','$label','$bounded'],['score','label','bounded'],len(scores))
    # Same relative converter and scene bindings cloned for three independently stored list items.
    name = 'derive-list-relative'
    root = '<ViewModel id="0:40" name="Player" defaultInstanceId="0:41">'+props+''.join(f'<ViewModelInstance id="0:{41+i}" name="{label}" exports="true">'+values(score)+'</ViewModelInstance>' for i,label,score in [(0,'Ada',1250),(10,'Lin',980),(20,'Sam',40)])+'</ViewModel>'+converter
    root += '<ViewModel id="0:200" name="Board" defaultInstanceId="0:201"><ViewModelPropertyList id="0:202" name="players"/><ViewModelInstance id="0:201" name="main"><ViewModelInstanceList viewModelPropertyId="0:202">'+''.join(f'<ViewModelInstanceListItem viewModelId="0:40" viewModelInstanceId="0:{41+i}" order="a{j}"/>' for j,i in enumerate([0,10,20]))+'</ViewModelInstanceList></ViewModelInstance></ViewModel><ComponentAsset name="Row" artboardId="0:1"/>'
    # Main must be first; row artboard's model paths contain no index or parent instance.
    board = '<Artboard id="0:210" name="Board" width="20" height="20" viewModelId="0:200" defaultStateMachineId="0:301" styleId="0:211"><LayoutComponentStyle id="0:211"/><ArtboardComponentList name="Rows">'+bind('0:200-0:202',800)+'</ArtboardComponentList>'+idle.replace('0:100','0:300').replace('0:101','0:301').replace('0:102','0:302')+'</Artboard>'
    row = '<Artboard id="0:1" name="Row" width="20" height="5" isComponent="true" viewModelId="0:40" defaultStateMachineId="0:101">'+custom+idle+'</Artboard>'
    rml = shell_scene(board+row,root)
    animl = (ROOT/'spec/conformance/derive-scoreboard/case.animl').read_text()
    commands = ['advance 2',dump_command(name,0),'data players[2]/score=1500','advance 2',dump_command(name,1),'data players[0]/score=980','advance 2',dump_command(name,2),'data players[1]/score=40','advance 2',dump_command(name,3)]
    addresses = [f'$players.{i}.{field}' for i in range(3) for field in ['score','label','bounded']]
    paths = [f'players[{i}]/{field}' for i in range(3) for field in ['score','label','bounded']]
    script=['advance 0','snapshot '+' '.join(addresses)]
    for i,score in [(2,1500),(0,980),(1,40)]:
        script += [f'set $players.{i}.score {score}','advance 0','snapshot '+' '.join(addresses)]
    d=setup(name,animl,rml,commands)
    write(d/'script.txt','\n'.join(script))
    if do_capture:
        capture(d)
        project(d,addresses,paths,4)
    return ['derive-score-label',name]


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--capture', action='store_true')
    args = parser.parse_args()
    names = comparison_cases(args.capture) + derive_cases(args.capture)
    # Compile authored Anima sources only; native expectations above never depend on this.
    subprocess.run(['node', '--input-type=module', '-e', """
import { compile } from '@anima-format/markup';
import { readFileSync, writeFileSync } from 'node:fs';
for (const name of JSON.parse(readFileSync(0, 'utf8'))) {
  const dir = 'tests/oracle/' + name + '/';
  const result = compile(readFileSync(dir + 'case.animl', 'utf8'));
  if (result.diagnostics.length) throw Error(JSON.stringify(result.diagnostics));
  writeFileSync(dir + 'case.ani', result.text);
}
"""], input=json.dumps(names), text=True, cwd=ROOT, check=True)

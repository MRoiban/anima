"""Independent native listener/formula probes; only local headless Rive commands."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RIVE = Path.home() / '.rive/bin/rive'
NAMES = ['data-bind-listener-actions', 'bind-action-clamp',
         'bind-event-expression', 'bind-condition-modulo']


def scene(clamp=False, event=False, modulo=False):
    increment = ('<FormulaTokenInput/><FormulaTokenOperation operationType="0"/>'
                 '<FormulaTokenValue operationValue="1"/>')
    if clamp:
        increment = ('<FormulaTokenFunction functionType="0"/>'
                     '<FormulaTokenValue operationValue="7"/><FormulaTokenArgumentSeparator/>'
                     + increment + '<FormulaTokenParenthesisClose/>')
    payload = '''<Event id="0:60" name="shared"><CustomPropertyNumber name="count" propertyValue="0">
<DataBindContext sourcePathIds="0:40-0:42" propertyKey="243"/>
<DataBindContext sourcePathIds="0:40-0:43" propertyKey="243" direction="true"/>
</CustomPropertyNumber></Event>''' if event else ''
    states = '<AnimationState id="0:102" animationId="0:100"/>'
    if modulo:
        # Read the current count through a native modulo converter, compare to zero.
        condition = '''<TransitionViewModelCondition><TransitionPropertyViewModelComparator>
<BindablePropertyNumber><DataBindContext sourcePathIds="0:40-0:42" propertyKey="636" converterId="0:81"/></BindablePropertyNumber>
</TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="0"/></TransitionViewModelCondition>'''
        positive = '''<TransitionViewModelCondition opValue="greaterThan"><TransitionPropertyViewModelComparator>
<BindablePropertyNumber><DataBindContext sourcePathIds="0:40-0:42" propertyKey="636"/></BindablePropertyNumber>
</TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="0"/></TransitionViewModelCondition>'''
        states = f'''<AnimationState id="0:102" animationId="0:100"><StateTransition stateToId="0:103">{positive}{condition}</StateTransition></AnimationState>
<AnimationState id="0:103" animationId="0:100"><StateMachineFireEvent eventId="0:60"/>
<StateTransition stateToId="0:102"><TransitionViewModelCondition opValue="notEqual"><TransitionPropertyViewModelComparator>
<BindablePropertyNumber><DataBindContext sourcePathIds="0:40-0:42" propertyKey="636" converterId="0:81"/></BindablePropertyNumber>
</TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="0"/></TransitionViewModelCondition></StateTransition></AnimationState>'''
    fire = '<ListenerFireEvent eventId="0:60"/>' if event and not modulo else ''
    return f'''<Rive version="1" kind="fragment">
<Artboard id="0:1" name="Oracle" width="240" height="240" viewModelId="0:40" defaultStateMachineId="0:101">
<Shape id="0:10" name="hit" x="120" y="120"><Rectangle width="240" height="240"/><Fill><SolidColor colorValue="FFFFFFFF"/></Fill></Shape>
{payload}<LinearAnimation id="0:100" name="hold" duration="60" fps="60"/>
<StateMachine id="0:101" name="s"><StateMachineLayer><EntryState><StateTransition stateToId="0:102"/></EntryState>{states}</StateMachineLayer>
<StateMachineListenerSingle name="increment" targetId="0:10" listenerTypeValue="click">
<ListenerViewModelChange fromViewModelProperty="true" fromDataBindId="0:99"><BindablePropertyNumber>
<DataBindContext id="0:99" sourcePathIds="0:40-0:42" propertyKey="636" converterId="0:80"/>
<DataBindContext sourcePathIds="0:40-0:42" propertyKey="636" direction="true"/>
</BindablePropertyNumber></ListenerViewModelChange>{fire}</StateMachineListenerSingle>
</StateMachine></Artboard>
<ViewModel id="0:40" name="Model" defaultInstanceId="0:41"><ViewModelPropertyNumber id="0:42" name="count"/><ViewModelPropertyNumber id="0:43" name="observed"/>
<ViewModelInstance id="0:41" name="Default" exports="true"><ViewModelInstanceNumber viewModelPropertyId="0:42" propertyValue="0"/><ViewModelInstanceNumber viewModelPropertyId="0:43" propertyValue="0"/></ViewModelInstance></ViewModel>
<DataConverterFormula id="0:80" name="increment">{increment}</DataConverterFormula>
<DataConverterFormula id="0:81" name="remainder"><FormulaTokenInput/><FormulaTokenOperation operationType="4"/><FormulaTokenValue operationValue="5"/></DataConverterFormula>
</Rive>\n'''


def capture():
    for name in NAMES + ['bind-condition-modulo/immediate-probe']:
        base = name.split('/')[0]
        project = ROOT / name / 'rive'
        project.mkdir(parents=True, exist_ok=True)
        project.joinpath('frames').mkdir(exist_ok=True)
        project.joinpath('rive.yaml').write_text(f'name: oracle-{base}\n')
        project.joinpath('scene.rml').write_text(scene(
            clamp=base == 'bind-action-clamp',
            event=base in NAMES[2:], modulo=base == 'bind-condition-modulo'))
        commands = ['data-dump frames/0.json']
        for i in range(1, 26):
            commands += ['pointer click@120,120']
            if '/' not in name:
                commands += ['advance 1']
            commands += [f'data-dump frames/{i}.json']
        project.joinpath('commands.txt').write_text('\n'.join(commands) + '\n')
        try:
            result = subprocess.run([str(RIVE), '.', '--commands=commands.txt'],
                                    cwd=project, capture_output=True, text=True, check=True)
            project.joinpath('session.txt').write_text(result.stdout + result.stderr)
            if 'err ' in result.stdout:
                raise RuntimeError(result.stdout)
            # Associate each ordered report with its following post-click dump.
            pending, events, observations = [], [], []
            for line in result.stderr.splitlines():
                if ' rive  event ' in line:
                    pending.append(line.split(' rive  event ', 1)[1])
                if ' rive  wrote frames/' in line:
                    index = int(line.split('frames/')[1].split('.')[0])
                    dump = json.loads(project.joinpath(f'frames/{index}.json').read_text())
                    values = {v['path']: v['value'] for v in dump['viewModel']['properties']}
                    events += [{'frame': index, 'name': e, 'payload': {'count': values['observed']}}
                               for e in pending]
                    observations.append({'click': index, 'values': {'count': values['count']},
                                         'events': [{'name': e, 'payload': {'count': values['observed']}}
                                                    for e in pending]})
                    pending = []
            if pending:
                raise RuntimeError(f'unframed events: {pending}')
            project.joinpath('events.json').write_text(json.dumps(events, indent=2) + '\n')
            project.joinpath('observations.json').write_text(json.dumps(observations, indent=2) + '\n')
            print(name, 'count', values['count'], 'events', len(events))
        finally:
            for binary in project.rglob('*.riv'):
                binary.unlink()


if __name__ == '__main__':
    capture()

"""CLI-only benchmark verification. Run from the repository root."""
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCENE = str(HERE / 'settings.animl')
CLI = ['node', 'packages/cli/src/main.ts']
EVIDENCE = HERE / 'evidence'
RUNS = []

def run(name, *args):
    result = subprocess.run(CLI + list(args), text=True, capture_output=True)
    (EVIDENCE / (name + '.stdout')).write_text(result.stdout)
    (EVIDENCE / (name + '.stderr')).write_text(result.stderr)
    RUNS.append({'name': name, 'args': list(args), 'exit': result.returncode})
    (EVIDENCE / 'runs.json').write_text(json.dumps(RUNS, indent=2) + '\n')
    assert result.returncode == 0, (name, result.stdout, result.stderr)
    return result.stdout

V = '$volume $volumeText $muted $selectedTab $email $push $sms $allChecked $someChecked generalPanel.visible soundPanel.visible volumeFill.width muteKnob.x mixedBar.visible notificationsFill.visible emailFill.visible pushFill.visible smsFill.visible'

def test(name, commands):
    # A full semantic snapshot before and after every tested action.
    script = HERE / (name + '.txt')
    script.write_text('\n'.join(commands) + '\n')
    output = run(name, 'sample', SCENE, '--semantics', '-s', str(script))
    rows = [json.loads(line) for line in output.splitlines() if line]
    (EVIDENCE / (name + '.json')).write_text(json.dumps(rows, indent=2) + '\n')
    return rows

def snap():
    return 'snapshot --semantics ' + V

def nodes(row):
    found = {}
    def visit(items):
        for n in items:
            found[n['id']] = n
            visit(n['children'])
    visit(row['semantics'])
    return found

def check(row, values=None, states=None, absent=()):
    for k, v in (values or {}).items():
        assert row['values'][k] == v, (k, row['values'][k], v)
    tree = nodes(row)
    for id, state in (states or {}).items():
        for k, v in state.items():
            assert tree[id]['states'][k] == v, (id, k, tree[id], v)
    for id in absent:
        assert id not in tree, id

run('validate', 'validate', SCENE, '--format=json')
run('build', 'build', SCENE, '-o', str(HERE / 'settings.ani'))

rows = test('tabs', ['advance 0', 'semantic generalTab focus', snap(),
    'key down ArrowRight', 'key up ArrowRight', snap(),
    'key down ArrowLeft', 'key up ArrowLeft', snap(),
    'semantic soundTab tap', snap(), 'semantic generalTab tap', snap()])
for i, selected in enumerate(['general', 'sound', 'general', 'sound', 'general']):
    check(rows[i], {'$selectedTab': selected, 'generalPanel.visible': selected=='general',
        'soundPanel.visible': selected=='sound'},
        {'generalTab': {'selected': selected=='general'}, 'soundTab': {'selected': selected=='sound'}},
        absent=('notifications',) if selected=='sound' else ('volume','mute'))
assert nodes(rows[0])['tabs']['role'] == 'tab-list'
assert nodes(rows[0])['generalTab']['label'] == 'General'
assert nodes(rows[0])['soundTab']['label'] == 'Sound'

rows = test('slider', ['advance 0', 'semantic soundTab tap', 'semantic volume focus', snap(),
    'key down ArrowRight', 'key up ArrowRight', snap(),
    'semantic volume increase', snap(), 'semantic volume decrease', snap(),
    'key down ArrowLeft', 'key up ArrowLeft', snap(),
    'key down End', 'key up End', snap(), 'semantic volume increase', snap(),
    'key down Home', 'key up Home', snap(), 'semantic volume decrease', snap()])
for row, value in zip(rows, [40,45,50,45,40,100,100,0,0], strict=True):
    check(row, {'$volume': value, '$volumeText': f'Volume {value} %', 'volumeFill.w': value*.3})
    n = nodes(row)['volume']
    assert (n['role'], n['value'], n['valueText'], n['min'], n['max'], n['step']) == ('slider', value, f'Volume {value} %', 0, 100, 5)

rows = test('switch', ['advance 0', 'semantic soundTab tap', 'semantic mute focus', snap(),
    'key down Enter', 'key up Enter', snap(), 'semantic mute tap', snap(),
    'key down Space', 'key up Space', snap()])
for row, value in zip(rows, [False,True,False,True], strict=True):
    check(row, {'$muted': value, 'muteKnob.x': 3 if value else 0}, {'mute': {'checked': value}})
    assert nodes(row)['mute']['role']=='switch'
    assert nodes(row)['mute']['label']=='Mute'

rows = test('checkboxes', ['advance 0', 'semantic notifications focus', snap(),
    'key down Space', 'key up Space', snap(), 'semantic notifications tap', snap(),
    'semantic email tap', snap(), 'semantic push tap', snap(), 'semantic sms tap', snap(),
    'semantic email tap', snap(), 'semantic notifications tap', snap(),
    'semantic notifications tap', snap()])
expected = [(True,False,False), (True,True,True), (False,False,False),
    (True,False,False), (True,True,False), (True,True,True),
    (False,True,True), (True,True,True), (False,False,False)]
for row, values in zip(rows, expected, strict=True):
    all_on, any_on = all(values), any(values)
    mixed = any_on and not all_on
    check(row, {'$email':values[0], '$push':values[1], '$sms':values[2],
        '$allChecked': all_on, '$someChecked':mixed, 'notificationsFill.visible':all_on,
        'mixedBar.visible':mixed, 'emailFill.visible':values[0], 'pushFill.visible':values[1],
        'smsFill.visible':values[2]}, {'notifications': {'checked':'mixed' if mixed else all_on},
        'email': {'checked':values[0]}, 'push': {'checked':values[1]}, 'sms': {'checked':values[2]}})

rows = test('pointer', ['advance 0', snap(), 'pointer click 19 3.5', 'advance 0', snap(),
    'pointer click 5 17.5', 'advance 0', snap(),
    'pointer click 7 3.5', 'advance 0', snap(),
    'pointer click 3 9', 'advance 0', snap(), 'pointer click 5 13', 'advance 0', snap()])
check(rows[1], {'$selectedTab':'sound'})
check(rows[2], {'$muted':True})
check(rows[3], {'$selectedTab':'general'})
check(rows[4], {'$email':True,'$push':True,'$sms':True})
check(rows[5], {'$email':False}, {'notifications': {'checked':'mixed'}})

rows = test('host', ['advance 0', snap(),
    'data set $generalTitle "Basics"', 'data set $soundTitle "Audio"',
    'data set $selectedTab "sound"', 'data set $volume 75', 'data set $muted true', 'advance 0', snap(),
    'data dump', 'data set $volume 200', 'advance 0', snap(),
    'data set $volume -10', 'advance 0', snap()])
# data dump is a separate output record.
snapshots = [r for r in rows if 'semantics' in r]
check(snapshots[1], {'$selectedTab':'sound', '$volume':75, '$muted':True})
assert nodes(snapshots[1])['generalTab']['label']=='Basics'
assert nodes(snapshots[1])['soundTab']['label']=='Audio'
check(snapshots[2], {'$volume':100})
check(snapshots[3], {'$volume':0})

run('render-general', 'render', SCENE, '-o', str(EVIDENCE/'general.svg'), '--size', '480')
run('render-sound', 'render', SCENE, '-o', str(EVIDENCE/'sound.svg'), '-e', 'advance 0; semantic soundTab tap', '--size', '480')
run('render-mixed', 'render', SCENE, '-o', str(EVIDENCE/'mixed.png'), '--size', '480')
(EVIDENCE/'assertions.txt').write_text('PASS: tabs, slider, switch, checkbox states/geometry, pointer, host data.\n')
print(f'PASS: {len(RUNS)} CLI runs; all semantic and data assertions passed.')

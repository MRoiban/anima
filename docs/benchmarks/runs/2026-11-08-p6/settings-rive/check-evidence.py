"""Assert captured data and accessibility states, without a pixel oracle."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).parent
EVIDENCE = ROOT / 'evidence'
checks = []

def record(message, condition):
    assert condition, message
    checks.append(message)

def data(prefix):
    p = next(EVIDENCE.glob(prefix + '-*.data.json'))
    return {v['name']: v['value'] for v in json.loads(p.read_text())['viewModel']['properties']}

def tree(prefix):
    p = next(EVIDENCE.glob(prefix + '-*.tree.json'))
    result = []
    def walk(n):
        result.append(n)
        for child in n.get('children', []):
            walk(child)
    for node in json.loads(p.read_text())['roots']:
        walk(node)
    return result

def node(prefix, label):
    return next(n for n in tree(prefix) if n['label'] == label)

initial = data('01')
record('Named settings have required defaults', all(initial[k] == v for k, v in {
    'volume': 40, 'muted': False, 'selectedTab': 'General', 'email': True,
    'push': False, 'sms': False, 'generalTitle': 'General', 'soundTitle': 'Sound'
}.items()))
source = ET.parse(ROOT / 'scene.rml')
runs = source.findall('.//TextValueRun')
record('All eight visible text runs bind string data; no literal label text',
       len(runs) == 8 and all(r.get('text') == '' and r.find('DataBindContext').get('propertyKey') == '268' for r in runs))
record('Renaming General updates its accessible name', node('12', 'Preferences')['role'] == 'tab')
record('Renaming Sound updates its accessible name', node('25', 'Audio')['role'] == 'tab')
record('Tabs are grouped in a tab list', len([n for n in tree('01') if n['role'] == 'tabList' and len(n['children']) == 2]) == 1)
for before, after, old, new in [('01', '02', 'General', 'Sound'), ('05', '06', 'Sound', 'General')]:
    record(f'Arrow key changes selection {old} to {new}',
           node(before, old)['stateFlags'] & 2 != 0 and node(after, new)['stateFlags'] & 2 != 0 and node(after, old)['stateFlags'] & 2 == 0)
    record(f'Only {new} panel remains in tree after arrow',
           [n['label'] for n in tree(after) if n['role'] == 'group'] == [new + ' panel'])
for prefix, expected in [('02', 40), ('03', 45), ('04', 40), ('14', 100), ('15', 100), ('16', 0), ('17', 0), ('18', 5), ('19', 0), ('25', 65)]:
    record(f'{prefix}: slider role, spoken value, data and drawn width follow {expected}',
           node(prefix, 'Volume')['role'] == 'slider' and node(prefix, 'Volume')['value'] == f'Volume {expected} %' and data(prefix)['volume'] == expected and abs(data(prefix)['volumeWidth'] - expected * 3.6) < .001)
for prefix, expected in [('02', False), ('05', True), ('20', True), ('21', False), ('25', True)]:
    record(f'{prefix}: switch semantic and stored state agree',
           node(prefix, 'Mute')['role'] == 'switchControl' and bool(node(prefix, 'Mute')['stateFlags'] & 16) == expected and data(prefix)['muted'] == expected)
record('Mute knob travels from left to right', abs(data('02')['knobX'] - 3.6) < .001 and abs(data('05')['knobX'] - 39.6) < .001)
for prefix, expected in [('01', 2), ('07', 1), ('08', 0), ('09', 2), ('10', 2), ('11', 1), ('26', 2), ('27', 1), ('28', 0), ('29', 1), ('30', 2)]:
    d = data(prefix)
    record(f'{prefix}: parent checked state and drawing agree ({expected})',
           (node(prefix, 'Notifications')['stateFlags'] >> 2) & 3 == expected and d['parentState'] == expected and d['parentFill'] == (1 if expected == 1 else 0) and d['parentBar'] == (1 if expected == 2 else 0))
    for label in ['Email', 'Push', 'SMS']:
        record(f'{prefix}: {label} semantic checkbox matches bool and drawn fill',
               node(prefix, label)['role'] == 'checkbox' and bool(node(prefix, label)['stateFlags'] & 4) == d[label.lower()] and d[label.lower() + 'Fill'] == int(d[label.lower()]))
record('Pointer tab selection', data('13')['selectedTab'] == 'Sound')
record('Accessibility tab selection', data('22')['selectedTab'] == 'General')
record('Pointer and keyboard child activation', data('23')['push'] is True and data('24')['push'] is False)
record('Host writes all three notification booleans', not data('26')['email'] and data('26')['push'] and data('26')['sms'])
record('Final inspect has no problems', json.loads((EVIDENCE / 'inspect-04.json').read_text())['problems'] == [])
record('Final verify has no errors or warnings', '0 errors, 0 warnings' in (EVIDENCE / 'verify-05.txt').read_text())
for number in [9, 8]:
    record(f'Capture {number} has no command errors', '\nerr ' not in (EVIDENCE / f'capture-{number:02}.stdout.txt').read_text())
print(json.dumps({'passed': len(checks), 'checks': checks}, indent=2))

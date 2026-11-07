"""Check captured runtime state against independently listed brief expectations."""
import json
from pathlib import Path

root = Path(__file__).parent
labels = [
    'Notifications',
    'Network and connectivity preferences',
    'Sound',
    'Display brightness and colour',
    'Privacy',
]
cases = {
    'before': ('', labels),
    'o': ('o', labels[:4]),
    'so': ('so', ['Sound']),
    'clear': ('', labels),
    'renamed': ('', labels[:2] + ['Audio settings'] + labels[3:]),
    'uppercase': ('SO', ['Sound']),
    'host-query': ('privacy', ['Privacy']),
    'literal': ('.', []),
}
for stage, (query, expected) in cases.items():
    data = json.loads((root / f'evidence/{stage}.data.json').read_text())
    values = {p['name']: p['value'] for p in data['viewModel']['properties']}
    tree = json.loads((root / f'evidence/{stage}.tree.json').read_text())
    nodes = tree['roots']
    assert values['query'] == query, (stage, 'query', values['query'])
    assert values['count'] == len(expected), (stage, 'count')
    assert values['countText'] == f'{len(expected)} results', (stage, 'countText')
    field = [n for n in nodes if n['role'] == 'textField']
    assert len(field) == 1 and field[0]['label'] == 'Search', (stage, 'field name')
    assert field[0]['value'] == query, (stage, 'field value')
    rows = [n['label'] for n in nodes if n['role'] == 'text' and n['headingLevel'] == 0]
    assert rows == expected + [f'{len(expected)} results'], (stage, 'visible accessible rows', rows)
    actual_labels = [values[f'label{i}'] for i in range(1, 6)]
    for i, label in enumerate(actual_labels, 1):
        assert values[f'hidden{i}'] == (label not in expected), (stage, 'hidden', i)
        assert values[f'opacity{i}'] == (1 if label in expected else 0), (stage, 'opacity', i)
    print(f'PASS {stage}: query={query!r}, count={len(expected)}, rows={expected}')
inspection = json.loads((root / 'evidence/inspect-02.json').read_text())
assert inspection['problems'] == [], inspection['problems']
print('PASS final inspect: problems=[]')

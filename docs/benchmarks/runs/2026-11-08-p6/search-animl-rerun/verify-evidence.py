"""Check CLI-produced evidence; does not implement any scene behavior."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).parent
snapshots = [json.loads(line) for line in (root / 'proof-output.jsonl').read_text().splitlines()]
expected = [('', 5), ('o', 4), ('so', 1), ('', 5), ('', 5), ('SO', 0), ('AU', 1), ('', 5)]
summary = []
for snapshot, (query, count) in zip(snapshots, expected, strict=True):
    values = snapshot['values']
    tree = snapshot['semantics']
    assert values['$query'] == query
    assert values['$count'] == count
    assert values['$summary'] == f'{count} results'
    field = next(node for node in tree if node['id'] == 'search')
    assert (field['role'], field['label'], field['value']) == ('text-field', 'Search', query)
    rows = [node for node in tree if node['id'].startswith('row')]
    assert len(rows) == count
    for i in range(5):
        label = values[f'$label{i}']
        shown = query.lower() in label.lower()
        assert values[f'row{i}.visible'] == shown
        assert values[f'$shown{i}'] == shown
        matches = [node for node in rows if node['id'] == f'row{i}']
        assert len(matches) == int(shown)
        if matches:
            assert matches[0]['label'] == label
    assert next(node for node in tree if node['id'] == 'total')['label'] == f'{count} results'
    assert values['search.opacity'] == (1 if query else .5)
    summary.append({'query': query, 'count': count, 'rows': [node['label'] for node in rows], 'field': field, 'tree': tree})

ns = {'s': 'http://www.w3.org/2000/svg'}
texts = {}
for name in ['text.svg', 'renamed.svg']:
    svg = ET.parse(root / name).getroot()
    texts[name] = [node.text for node in svg.findall('.//s:tspan', ns)]
assert texts['text.svg'] == ['Search', 'Notificatio…', 'Network and …', 'Sound', 'Display brig…', 'Privacy', '5 results']
assert texts['renamed.svg'] == ['Search', 'Notificatio…', 'Network and …', 'Audio', 'Display brig…', 'Privacy', '5 results']
for i in range(14):
    assert snapshots[-1]['values'][f'title.effects.{i}.y'] == 0
    assert snapshots[-1]['values'][f'title.effects.{i}.opacity'] == 1
(root / 'evidence-summary.json').write_text(json.dumps({'snapshots': summary, 'drawnText': texts}, indent=2, ensure_ascii=False) + '\n')
print('PASS: 8 data/tree snapshots, filtering/count/name/value/visibility checks, drawn ellipses and rename, title final values.')

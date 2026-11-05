"""Check recorded CLI evidence without importing runtime implementation."""
import json
from pathlib import Path
p = Path(__file__).parent
press = [json.loads(s) for s in (p / 'press.jsonl').read_text().splitlines()]
badge = [json.loads(s) for s in (p / 'badge.jsonl').read_text().splitlines()]
checks = 0

def equals(actual, expected):
    global checks
    assert actual == expected, (actual, expected)
    checks += 1

for row, address, expected in [
    (1, 'bell/icon.scale', 1.03), (2, 'bell/icon.scale', 1.06),
    (3, 'bell/icon.scale', 0.99), (4, 'bell/icon.scale', 0.92),
    (5, 'bell/icon.scale', 1.06), (6, 'folder/icon.scale', 1.06),
    (7, 'folder/icon.scale', 0.92), (8, 'folder/icon.scale', 1.06),
    (9, 'trash-button/icon.scale', 1.06), (10, 'trash-button/icon.scale', 0.92),
    (11, 'trash-button/icon.scale', 1.06), (5, 'unread', 0),
]:
    equals(press[row]['values'][address], expected)
for value in press[-1]['values'].values():
    equals(value, 1)
equals(badge[0]['values']['bell-badge/count'], 3)
equals(badge[0]['values']['trash-badge/count'], 0)
equals(badge[0]['values']['trash-badge/badge.visible'], False)
for instance in ['bell-badge', 'trash-badge']:
    for row, scale in [(1, 1), (2, 1.25), (3, 1)]:
        equals(badge[row]['values'][instance + '/badge.scale'], scale)
equals(badge[1]['values']['bell-badge/count'], 4)
equals(badge[1]['values']['trash-badge/count'], 2)
equals(badge[4]['values']['bell-badge/count'], 2)
equals(badge[4]['values']['bell-badge/dot3.opacity'], 0)
equals(badge[5]['values']['bell-badge/badge.scale'], 1)
equals(badge[6]['values']['unread'], 0)
equals(badge[6]['values']['bell-badge/badge.visible'], False)
equals(badge[6]['values']['trash-badge/count'], 2)
equals(badge[6]['values']['trash-badge/badge.visible'], True)
equals(badge[7]['values']['bell-badge/badge.scale'], 1.25)
equals(badge[8]['values']['bell-badge/badge.scale'], 1)
equals(badge[-1]['settled'], True)
doc = json.loads((p / 'toolbar.ani').read_text())
equals(doc['viewBox'], [0, 0, 72, 24])
print(f'{checks} evidence assertions passed')

"""Check retained sample outputs independently; invoke from this directory."""
import itertools
import json
from pathlib import Path


def read(name):
    return [json.loads(line) for line in Path(name + '.jsonl').read_text().splitlines()]


def close(actual, expected):
    assert abs(actual - expected) < 1e-8, (actual, expected)


host = read('host')
v = host[0]['values']
assert v['$players.length'] == 3
for i, (name, score, colour) in enumerate([
    ('Ada', 1250, '#d97757'), ('Lin', 980, '#6a9bcc'), ('Sam', 40, '#788c5d')
]):
    node = name.lower()
    assert v[f'$players.{i}.name'] == name
    assert v[f'$players.{i}.score'] == score
    assert v[f'$players.{i}.colour'] == colour
    assert v[f'{node}.fill.color'] == v[f'{node}Bar.fill.color'] == colour
    close(v[f'{node}Bar.w'], 30 * score / 2000)
    assert v[f'{node}.properties.label'] == f'{score:,} pts'
for row, node, score, colour in [(1, 'lin', 1800, '#123456'),
                                  (2, 'sam', 1900, '#abcdef'),
                                  (3, 'ada', 2000, '#654321')]:
    v = host[row]['values']
    close(v[f'{node}Bar.w'], 30 * score / 2000)
    assert v[f'{node}.fill.color'] == v[f'{node}Bar.fill.color'] == colour
    assert v[f'{node}.properties.label'] == f'{score:,} pts'
assert host[3]['values']['$main:players.0.score'] == 2000
assert host[3]['values']['knob.x'] == 2000
assert host[5]['values']['knob.x'] == 100
assert host[5]['values']['ada.properties.label'] == '100 pts'
for row, leader in zip(host, ['ada', 'lin', 'sam', 'ada', 'ada', 'lin']):
    for node in ['ada', 'lin', 'sam']:
        assert row['values'][f'{node}Bar.stroke.width'] == (0.5 if node == leader else 0)
for row, score in zip(read('drag'), [1500, 1000, 2000, 0, 1000, 1200, 1200], strict=True):
    close(row['values']['$players.0.score'], score)
    close(row['values']['knob.x'], score)
    if 'adaBar.w' in row['values']:
        close(row['values']['adaBar.w'], 30 * score / 2000)
        assert row['values']['ada.properties.label'] == f'{score:,} pts'
for i, row in enumerate(read('milestone')):
    signals = [event for event in row['events'] if event['name'] == 'milestone']
    assert len(signals) == (1 if i in [2, 7, 9, 12] else 0), (i, signals)
rankings = read('rankings')
for row, scores in zip(rankings, itertools.product([0, 980, 1500], repeat=3), strict=True):
    leader = scores.index(max(scores))
    for i, node in enumerate(['ada', 'lin', 'sam']):
        assert row['values'][f'{node}Bar.stroke.width'] == (0.5 if i == leader else 0)
assert read('built-host') == host
print('PASS: defaults; all 3 host score/colour writes; formatted node labels; drag/clamps/grab offset; host knob updates; 27 rankings/ties; 4 milestone crossings; built/source sample parity')

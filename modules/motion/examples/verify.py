"""CLI-only acceptance proof; independently expected scalars, no player imports.
Run from any directory: python modules/motion/examples/verify.py
JSONL evidence is regenerated only after all assertions succeed.
"""
import json
import math
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CLI = ['node', str(ROOT / 'packages/cli/src/main.ts')]

def cli(*args):
    return subprocess.run(CLI + list(map(str, args)), cwd=ROOT, text=True,
                          capture_output=True, check=True).stdout

def near(actual, expected):
    assert math.isclose(actual, expected, abs_tol=1e-8), (actual, expected)

def column(rows, address, expected):
    assert len(rows) == len(expected), (address, len(rows), len(expected))
    for row, value in zip(rows, expected):
        near(row['values'][address], value)

built = cli('build', HERE / 'sync.animl')
assert json.loads(built) == json.loads((HERE / 'sync.ani').read_text())
for ext in ['animl', 'ani']:
    cli('validate', HERE / ('sync.' + ext))
results = {}
for script in sorted((HERE / 'scripts').glob('*.txt')):
    text = cli('sample', HERE / 'sync.ani', '--script', script)
    rows = [json.loads(line) for line in text.splitlines()]
    results[script.stem] = (text, rows)

def rows(name):
    return results[name][1]

column(rows('spin'), 'arrows.rotate', [0, 0, 30, 330, 0, 30])
column(rows('sweep')[:13], 'arrows.rotate', [0] + list(range(30, 360, 30)) + [0])
column(rows('sweep')[13:], 'arrows.rotate', [0] + list(range(0, 360, 30)))
column(rows('stop'), 'arrows.rotate', [90, 90, 90, 120, 120, 120, 120, 180, 0, 30])
column(rows('stop'), 'check.scale', [0, 0, 0, 0, 1 + math.sqrt(2)/4, 1, 1, 1, 0, 0])
assert [row['states']['rotation'] for row in rows('stop')[:4]] == ['spin', 'spin', 'spin', 'idle']
assert rows('stop')[6]['settled']
column(rows('hover'), 'peek.scale', [1.05, 1.05, 1.025, 1.025, 1.05, 1, 1.1, 1])
assert rows('hover')[5]['settled'] and rows('hover')[-1]['settled']
column(rows('phase'), 'arrows.rotate', [0, 0, 30, 60, 180, 330, 0, 0, 30])
column(rows('reduced'), 'arrows.rotate', [0] * 6)
column(rows('reduced'), 'check.scale', [0, 0, 0, 1, 1, 1])
assert all(row['settled'] for row in rows('reduced'))
column(rows('rest'), 'arrows.rotate', [0])
column(rows('rest'), 'peek.scale', [1])
column(rows('rest'), 'check.scale', [0])
# Geometry checks complement rest-state samples; the paths use the brief's exact check tips.
doc = json.loads(built)
assert doc['grid'] == 20 and doc['colors'] == {'ink': '#141413', 'accent': '#d97757'}
peek, check = doc['nodes']
assert peek['pivot'] == [10, 10] and check['pivot'] == [10, 10]
assert check['d'] == 'M7 10L9.2 12.2L13 8'
arrows = peek['children'][0]
assert arrows['pivot'] == [10, 10]
for arc, angles in zip(arrows['children'][::2], [(-165, -15), (15, 165)]):
    assert arc['center'] == [10, 10] and arc['r'] == 6
    assert (arc['from'], arc['to']) == angles
    assert arc['stroke']['width'] == 1.5 and arc['stroke']['cap'] == 'round'
for name, (text, _) in results.items():
    (HERE / 'evidence' / (name + '.jsonl')).write_text(text)
print('sync example: 6/6 items; 7 sample scripts,', sum(len(r) for _, r in results.values()), 'snapshots')
print('1: twelve ticks/loop; 2: next tick + held angle + elastic pop; 3: reversible peek/turnaround')
print('4: quantized input scrub; 5: reduced still/instant check; 6: rest arrows only')

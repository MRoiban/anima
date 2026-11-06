"""Re-run numerical evidence on both authored AniML and compiled ANI. Run from repo root."""
import json
import math
import pathlib
import subprocess
import sys

base = pathlib.Path(__file__).resolve().parent

def close(actual, expected):
    assert math.isclose(actual, expected, abs_tol=1e-9), (actual, expected)

def sample(document, name):
    p = subprocess.run([sys.executable, str(base / 'check.py'), 'sample', str(document),
                        '-s', str(base / (name + '.script'))], capture_output=True, text=True)
    assert p.returncode == 0, p.stderr
    rows = [json.loads(line) for line in p.stdout.splitlines()]
    (base / (document.suffix[1:] + '-' + name + '.jsonl')).write_text(p.stdout)
    return rows

for ext in ['animl', 'ani']:
    document = base / ('volume.' + ext)
    rows = sample(document, 'inputs')
    levels = [0.5, 0, 0.165, 0.33, 0.495, 0.66, 0.83, 1]
    assert len(rows) == len(levels)
    for row, volume in zip(rows, levels):
        v = row['values']
        close(v['volume'], volume)
        close(12 + 24 * v['knob.x'], 12 + 24 * volume)
        close(v['fill.stroke.trimEnd'], volume)
        for i, (start, end) in enumerate([(0, 0.33), (0.33, 0.66), (0.66, 1)], 1):
            close(v[f'wave{i}.opacity'], min(1, max(0, (volume - start) / (end - start))))
    rows = sample(document, 'drag')
    expected = [0.5, 0.5, 0.75, 1, 0, 0.25, 0.25, 0.25, 0.5]
    assert len(rows) == len(expected)
    for row, volume in zip(rows, expected):
        close(row['values']['volume'], volume)
        close(row['values']['knob.x'], volume)
    rows = sample(document, 'keyboard')
    # This checks and preserves the observed FAILURE, not conformance to item 3.
    observed = [row['values']['volume'] for row in rows]
    assert observed == [0.5, 0.5, 0.5, 0.5, 1, 0], observed
    print(ext + ': item 3 UNMET: focused Right, Right, Left leave volume at 0.5')
    rows = sample(document, 'pulse')
    scales = [1, 1, 1.04, 1.08, 1.04, 1, 1, 1, 1.08, 1, 1.08, 1]
    assert len(rows) == len(scales)
    for row, scale in zip(rows, scales):
        close(row['values']['speaker.scale'], scale)
    assert rows[6]['states']['feedback'] == rows[7]['states']['feedback'] == 'idle'
    rows = sample(document, 'mute')
    assert [r['values']['muted'] for r in rows] == [False, True, True, False]
    for row in rows:
        v = row['values']
        close(v['waves.opacity'], 1 - v['muted'])
        close(v['mute-line.opacity'], v['muted'])
    close(rows[-1]['values']['volume'], 0.165)
    for i, expected in enumerate([0.5, 0, 0], 1):
        close(rows[-1]['values'][f'wave{i}.opacity'], expected)
    print(ext + ': items 1, 2, 4, 5, 6 PASS')

# Geometry is independent of samples, checked against the brief in the compiled artifact.
doc = json.loads((base / 'volume.ani').read_text())
assert doc['viewBox'] == [0, 0, 40, 12]
assert doc['colors'] == {'ink': '#141413', 'accent': '#d97757'}
by_id = {}
def visit(nodes):
    for node in nodes:
        by_id[node['id']] = node
        visit(node.get('children', []))
visit(doc['nodes'])
assert by_id['speaker']['pivot'] == [5, 6]
assert by_id['body']['x0'] == 2 and by_id['body']['y0'] == 4
assert by_id['body']['w'] == 3 and by_id['body']['h'] == 4
assert by_id['cone']['d'] == 'M5 4 L8 2 L8 10 L5 8 Z'
for i, radius in enumerate([2, 3.5, 5], 1):
    n = by_id[f'wave{i}']
    assert n['center'] == [8, 6] and n['r'] == radius
    assert n['from'] == -45 and n['to'] == 45 and n['stroke']['width'] == 1
assert by_id['slider-space']['x'] == 12 and by_id['slider-space']['y'] == 6
assert by_id['slider-space']['scaleX'] == 24
close(24 * by_id['knob']['scaleX'], 1)
assert by_id['knob']['r'] == 1.5
print('Geometry PASS; strict brief result: 5/6. Keyboard arithmetic remains unmet.')

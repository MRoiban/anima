"""Independent assertions over the retained CLI observations; no runtime imports.

Run check-cli.py sample again after changing sync.animl; these checks read saved
observations, and deliberately expose the active reduced-motion limitation.
"""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent

def rows(name):
    return [json.loads(s) for s in (HERE / (name + '.jsonl')).read_text().splitlines()]

def near(actual, expected):
    assert math.isclose(actual, expected, abs_tol=1e-8), (actual, expected)

for r in rows('rest'):
    for key, value in [('arrows.rotate', 0), ('check.scale', 0), ('peek.scale', 1)]:
        near(r['values'][key], value)
    assert r['settled']

r = rows('ticks')
assert {round(x['values']['arrows.rotate']) for x in r} == set(range(0, 360, 30))
for x in r:
    near(x['values']['check.scale'], 0)
    # Sample halfway between ticks, excluding binary-floating-point boundaries.
    t = x['time']
    if abs((t * 10) % 1 - 0.5) < 1e-8:
        near(x['values']['arrows.rotate'], math.floor((t % 1.2) * 10) * 30)
for t in [1.25, 2.45]:
    near(min(r, key=lambda x: abs(x['time'] - t))['values']['arrows.rotate'], 0)

assert rows('built-stop') == rows('stop'), 'Built .ani differs from AniML stop trace'
r = rows('stop')
for x, angle, scale in zip(r, [60,60,60,90,90,90,90,240], [0,0,0,0,1.3535533905932737,1,1,1]):
    near(x['values']['arrows.rotate'], angle)
    near(x['values']['check.scale'], scale)
assert r[5]['settled'] and r[6]['settled']

r = rows('hover')
for x, scale in zip(r, [1.04,1.04,1.025,1.025,1.1,1]):
    near(x['values']['peek.scale'], scale)
assert r[-1]['settled']

for x in rows('scrub'):
    phase = x['values']['phase']
    # Circular angle equivalence: a full turn at phase=1 is visually 0 degrees.
    near(x['values']['arrows.rotate'], (math.floor(phase * 12) % 12) * 30)
    near(x['values']['check.scale'], 0)
    assert x['settled']

r = rows('reduced')
for x, scale in zip(r, [0,0,0,1,1,1]):
    near(x['values']['arrows.rotate'], 0)
    near(x['values']['check.scale'], scale)
    assert x['settled']

r = rows('edge')
near(r[0]['values']['arrows.rotate'], 0)
near(r[1]['values']['arrows.rotate'], 0)
near(r[2]['values']['arrows.rotate'], 30)
near(r[2]['values']['check.scale'], 1)
assert r[2]['settled']
print('PASS: ticking, aligned stop/pop, hover reversal, scrubbing, reduced-at-entry, rest; cancellation/large-dt checks.')
assert r[3]['values']['arrows.rotate'] != r[4]['values']['arrows.rotate']
assert not r[5]['settled']
print('KNOWN FAILURE: reducing motion during an active spin does not freeze it; stop remains pending. Item 5 partial, strict score 5/6.')

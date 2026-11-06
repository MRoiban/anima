"""Check saved AniML samples, then replay each script against the built .ani.
Run from repo root: python3 docs/benchmarks/runs/2026-11-10-p4c/animl-rerun/verify.py
Each invocation runs five anima sample commands and one assertion check.
"""
import json
import math
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
NAMES = ('inputs', 'drag', 'keys', 'pulse', 'mute')
rows = {}
checks = 0


def eq(actual, expected):
    global checks
    if isinstance(expected, dict):
        for key, value in expected.items():
            eq(actual[key], value)
    elif isinstance(expected, list):
        assert len(actual) == len(expected), (actual, expected)
        for a, b in zip(actual, expected):
            eq(a, b)
    elif isinstance(expected, (int, float)) and not isinstance(expected, bool):
        assert math.isclose(actual, expected, abs_tol=1e-10), (actual, expected)
        checks += 1
    else:
        assert actual == expected, (actual, expected)
        checks += 1


for name in NAMES:
    saved = [json.loads(line) for line in (HERE / (name + '.jsonl')).read_text().splitlines()]
    result = subprocess.run(
        ['node', 'packages/cli/src/main.ts', 'sample', str(HERE / 'volume.ani'),
         '-s', str(HERE / (name + '.script'))], cwd=ROOT,
        capture_output=True, text=True, check=True)
    (HERE / (name + '-built.jsonl')).write_text(result.stdout)
    built = [json.loads(line) for line in result.stdout.splitlines()]
    eq(built, saved)
    rows[name] = [row['values'] for row in saved]

# The rail's authored transform maps local volume to world x = 12 + 24*volume.
for row, volume in zip(rows['inputs'], [.5, 0, .165, .33, .495, .66, .83, 1]):
    eq(row['volume'], volume)
    eq([row['wave1.opacity'], row['wave2.opacity'], row['wave3.opacity']],
       [min(1, max(0, volume/.33)), min(1, max(0, (volume-.33)/.33)),
        min(1, max(0, (volume-.66)/.34))])
for row in rows['inputs']:
    if 'knob.x' in row:
        eq(row['knob.x'], row['volume'])
        eq(row['fill.stroke.trimEnd'], row['volume'])
for row, volume in zip(rows['drag'], [.75, 1, 0, .25, .25, .5, .5]):
    eq(row, {'volume': volume, 'knob.x': volume, 'fill.stroke.trimEnd': volume})
for row, volume in zip(rows['keys'], [.5, .6, .5, .4, 1, 0, 0]):
    eq(row['volume'], volume)
for row, scale in zip(rows['pulse'], [1, 1, 1.08, 1, 1, 1.04, 1, 1.08, 1.08, 1, 1]):
    eq(row['speaker.scale'], scale)
for row, muted in zip(rows['mute'], [False, True, True, False, True]):
    eq(row, {'muted': muted, 'waves.opacity': int(not muted), 'slash.opacity': int(muted)})
eq(rows['mute'][3], {'volume': .83, 'wave1.opacity': 1, 'wave2.opacity': 1, 'wave3.opacity': .5})
print(f'PASS: {checks} comparisons; 5 built sample runs; 6/6 brief behaviors checked.')

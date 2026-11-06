"""Independent sample assertions. Run from repository root; appends checks to the ledger."""
import itertools
import json
import math
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
NAMES = ['ada', 'lin', 'sam']
COLORS = ['#d97757', '#6a9bcc', '#788c5d']


def run(extension, script, expected_error=False):
    result = subprocess.run([sys.executable, str(HERE / 'check.py'), 'sample',
                             str(HERE / f'scoreboard.{extension}'), '-s',
                             str(HERE / f'{script}.sample')], capture_output=True, text=True)
    if expected_error:
        assert result.returncode != 0, 'computed label was writable'
        assert 'takes a string' in result.stderr, result.stderr
        return []
    assert result.returncode == 0, result.stderr
    return [json.loads(line) for line in result.stdout.splitlines()]


def check(frame, scores, colors=COLORS):
    values = frame['values']
    assert values['$players.length'] == 3
    leader = max(range(3), key=lambda i: scores[i])
    for i, name in enumerate(NAMES):
        assert values[f'$players.{i}.name'] == name.capitalize()
        assert math.isclose(values[f'$players.{i}.score'], scores[i], abs_tol=1e-8)
        assert values[f'$players.{i}.tint'] == colors[i]
        # Cases avoid exactly-half rounding, whose policy is format-specific.
        assert values[f'$players.{i}.label'] == f'{scores[i]:,.0f} pts'
        assert math.isclose(values[f'{name}-bar.w'], 30 * scores[i] / 2000, abs_tol=1e-8)
        assert values[f'{name}-bar.fill.color'] == colors[i]
        assert values[f'{name}-swatch.fill.color'] == colors[i]
        assert values[f'{name}-bar.stroke.width'] == (0.5 if i == leader else 0)
    assert math.isclose(values['knob.x'], scores[0], abs_tol=1e-8)
    return sum(event['name'] == 'milestone' for event in frame['events'])


summary = {}
all_frames = {}
for extension in ['animl', 'ani']:
    defaults = run(extension, 'defaults')
    assert len(defaults) == 1
    assert check(defaults[0], [1250, 980, 40]) == 0
    host = run(extension, 'host')
    assert len(host) == 31
    for frame, scores in zip(host[:27], itertools.product([0, 1000, 2000], repeat=3)):
        check(frame, scores)
    colors = COLORS.copy()
    for i, color in enumerate(['#123456', '#abcdef', '#fedcba']):
        colors[i] = color
        check(host[27+i], [2000, 2000, 2000], colors)
    check(host[30], [1234.25, 2000, 2000], colors)
    milestone = run(extension, 'milestone')
    scores = [1250, 1499, 1500, 1501, 1500, 1499, 1500, 2000, 0, 1600, 1600, 1600]
    assert len(milestone) == len(scores)
    counts = [check(frame, [score, 980, 40]) for frame, score in zip(milestone, scores)]
    assert counts == [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0], counts
    drag = run(extension, 'drag')
    scores = [1250, 1300, 1500, 1550, 2000, 2000, 1000, 0, 0, 0, 500, 1500, 1500, 500, 1000, 1000]
    assert len(drag) == len(scores)
    counts = [check(frame, [score, 980, 40]) for frame, score in zip(drag, scores)]
    assert counts == [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0], counts
    fractional = run(extension, 'fractional')
    assert len(fractional) == 2
    for frame in fractional:
        values = frame['values']
        assert math.isclose(values['$main:players.0.score'], 1300.0666666666666, abs_tol=1e-8)
        assert math.isclose(values['ada-bar.w'], 19.501, abs_tol=1e-8)
        assert math.isclose(values['knob.x'], 1300.0666666666666, abs_tol=1e-8)
        assert values['$main:players.0.label'] == '1,300 pts'
        assert frame['events'] == []
    written_name = run(extension, 'name-write')
    assert written_name[0]['values'] == {'$players.0.name': 'Grace', '$players.0.label': '1,250 pts'}
    run(extension, 'readonly', expected_error=True)
    all_frames[extension] = [defaults, host, milestone, drag, fractional, written_name]
    summary[extension] = dict(snapshots=63, ranking_cases=27, milestone_host=3, milestone_drag=2,
                              readonly_rejections=1)
assert all_frames['animl'] == all_frames['ani'], 'compiled source behavior differs'
summary['source_build_parity'] = True
(HERE / 'evidence' / 'verification.json').write_text(json.dumps(summary, indent=2)+'\n')
print(json.dumps(summary, indent=2))

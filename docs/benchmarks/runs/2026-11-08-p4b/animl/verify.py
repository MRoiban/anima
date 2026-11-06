"""CLI-only evidence collection; never imports runtime source. Run from repo root."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent
CLI = ['node', 'packages/cli/src/main.ts']
ledger = json.loads((ROOT / 'checks.json').read_text()) if (ROOT / 'checks.json').exists() else []


def run(args, output=None):
    result = subprocess.run(CLI + list(map(str, args)), text=True, capture_output=True)
    ledger.append({'args': list(map(str, args)), 'exit': result.returncode,
                   'stderr': result.stderr, 'stdout': result.stdout if not output else str(output)})
    (ROOT / 'checks.json').write_text(json.dumps(ledger, indent=2) + '\n')
    if output:
        (ROOT / output).write_text(result.stdout)
    assert result.returncode == 0, result.stdout + result.stderr
    return result.stdout


source = ROOT / 'sync.animl'
built = ROOT / 'sync.ani'
run(['build', source, '-o', built])
run(['validate', built])
for name in ['spin', 'stop', 'hover', 'phase', 'reduced', 'host-reverse', 'sweep']:
    run(['sample', built, '-s', ROOT / (name + '.script')], name + '.jsonl')
for name, commands in [
    ('rest', 'advance 0'),
    ('ticking', 'advance 0; set syncing true; advance 0; advance 0.35'),
    ('elastic', 'advance 0; set syncing true; advance 0; advance 0.35; set syncing false; advance 0; advance 0.09'),
    ('reduced', 'motion reduce; advance 0; set syncing true; advance 0; advance 0.35; set syncing false; advance 0'),
    ('hover', 'advance 0; pointer move 10 10; advance 0.4'),
]:
    run(['render', built, '-e', commands, '--size', '400', '-o', ROOT / (name + '.png')])
run(['render', built, '-e', 'advance 0', '-o', ROOT / 'rest.svg'])


def values(name, address):
    return [json.loads(line)['values'][address]
            for line in (ROOT / (name + '.jsonl')).read_text().splitlines()]


def near(actual, expected):
    assert len(actual) == len(expected), (actual, expected)
    assert all(abs(a - e) < 1e-8 for a, e in zip(actual, expected)), (actual, expected)


near(values('spin', 'arrows.rotate'), [0, 0, 0, 30, 60, 90, 330, 0, 30])
near(values('phase', 'arrows.rotate'), [0, 0, 30, 60, 180, 330, 360, 0, 30])
near(values('reduced', 'arrows.rotate'), [0] * 7)
near(values('reduced', 'check.scale'), [0, 0, 0, 0, 1, 1, 1])
near(values('hover', 'peek.scale'), [1.05, 1.05, 1.0375, 1.025, 1, 1.1, 1])
near(values('host-reverse', 'peek.scale'), [1.05, 1.05, 1.025, 1])
near(values('sweep', 'arrows.rotate'),
     list(range(0, 360, 30)) + [0] + list(range(0, 361, 30)) + [0])
stop_angles = values('stop', 'arrows.rotate')
near(stop_angles, [90, 0, 0, 0, 0])  # Records the unmet finish-step requirement.
stop_scales = values('stop', 'check.scale')
assert stop_scales[0] == stop_scales[1] == 0
assert stop_scales[2] > 1  # Actual elastic overshoot, not just source inspection.
near(stop_scales[3:], [1, 1])
for name in ['spin', 'stop', 'hover', 'phase', 'reduced', 'host-reverse', 'sweep']:
    for line in (ROOT / (name + '.jsonl')).read_text().splitlines():
        assert all(e.get('name') != '@limit' for e in json.loads(line)['events'])
print(f'{len(ledger)} recorded CLI runs; this run and numerical assertions passed')

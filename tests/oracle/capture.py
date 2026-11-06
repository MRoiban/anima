#!/usr/bin/env python3
"""Recapture committed references using only the local Rive headless command runner."""
from capture_events import capture_events

import sys
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent
if '--interaction' in sys.argv:
    subprocess.run([sys.executable, str(root.parent.parent / 'modules/input/capture-interaction.py'), '--all'], check=True)
    sys.exit(0)
cases = json.loads((root / 'cases.json').read_text())
cases += [json.loads(p.read_text())['case'] for p in root.glob('**/finding.json')]
if '--skip-evidence' in sys.argv:
    for skip in root.glob('*/skip.json'):
        if not (skip.parent / 'rive' / 'commands.txt').exists():
            continue
        project = skip.parent / 'rive'
        try:
            result = subprocess.run(
                [str(Path.home() / '.rive/bin/rive'), '.', '--commands=commands.txt'],
                cwd=project, capture_output=True, text=True, check=True,
            )
            if 'err ' in result.stdout:
                raise RuntimeError(result.stdout + result.stderr)
            (project / 'session.txt').write_text(result.stdout + result.stderr)
            print(skip.parent.name, 'captured skip evidence')
        finally:
            for binary in project.rglob('*.riv'):
                binary.unlink()
    sys.exit(0)
for case in cases:
    if '--events' in sys.argv and not case.get('events'):
        continue
    project = root / case['name'] / ('rive' if (root / case['name'] / 'rive').exists() else '.')
    try:
        if case.get('events'):
            capture_events(project, case['events'])
            print(case['name'], 'captured events')
            continue
        suffix = 'json' if case.get('values') else 'png'
        for old in (project / 'frames').glob(f'*.{suffix}'):
            old.unlink()
        result = subprocess.run(
            [str(Path.home() / '.rive/bin/rive'), '.', '--commands=commands.txt'],
            cwd=project, capture_output=True, text=True, check=True,
        )
        if 'err ' in result.stdout:
            raise RuntimeError(result.stdout + result.stderr)
        for time in case['times']:
            assert (project / 'frames' / f'{time}.{suffix}').is_file(), case['name']
        print(case['name'], 'captured')
    finally:
        # Never read/convert the build's binary artifacts or retain them for commit.
        for binary in project.rglob('*.riv'):
            binary.unlink()

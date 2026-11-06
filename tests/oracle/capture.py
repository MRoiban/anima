#!/usr/bin/env python3
"""Recapture committed references using only the local Rive headless command runner."""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent
for case in json.loads((root / 'cases.json').read_text()):
    project = root / case['name'] / 'rive'
    try:
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

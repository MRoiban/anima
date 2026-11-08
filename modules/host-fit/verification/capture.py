#!/usr/bin/env python3
"""Capture locally authored native fit probes; discard all binary/build artifacts unread."""
from pathlib import Path
import shutil
import subprocess

project = Path(__file__).resolve().parent / 'native'
for old in (project / 'frames').glob('*.png'):
    old.unlink()
try:
    result = subprocess.run([
        str(Path.home() / '.rive/bin/rive'), '.', '--commands=commands.txt', '--viewport=240x120'
    ], cwd=project, capture_output=True, text=True, check=False)
    (project / 'session.txt').write_text(result.stdout + result.stderr)
    for fit in ['contain', 'cover', 'fill', 'fit-width', 'fit-height', 'none', 'scale-down', 'layout']:
        if not (project / 'frames' / (fit + '.png')).is_file():
            raise RuntimeError('missing capture: ' + fit)
    if "err alignment: unknown command" not in result.stdout or "err artboard-size: unknown command" not in result.stdout:
        raise RuntimeError('native host command support changed; review skip evidence')
finally:
    for binary in project.rglob('*.riv'):
        binary.unlink()
    shutil.rmtree(project / 'build', ignore_errors=True)

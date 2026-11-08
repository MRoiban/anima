"""Replay P7 independently authored parameter controls; never inspect native binaries."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent
CLI = str(Path.home() / '.rive/bin/rive')
for project, controls in [
    ('p7-text-fit-controls', ['9', '9.6', '10', '10.2', '10.5']),
    ('p7-text-geometry-controls', ['baseline-visible', 'baseline-false', 'baseline-1.5',
                                 'trim-none', 'trim-explicit', 'ellipsis-literal', 'ellipsis-dots']),
    ('p7-text-run-list-controls', ['property-only', 'root-relative', 'property-relative',
                                  'global-symbol', 'local-symbol', 'global-property']),
]:
    path = ROOT / project / 'rive'
    original = (path / 'scene.rml').read_text()
    commands = (path / 'commands.txt').read_text()
    try:
        for name in controls:
            (path / 'scene.rml').write_text((path / (name + '.rml.txt')).read_text())
            script = f'screenshot frames/{name}.png\n'
            if project == 'p7-text-run-list-controls':
                script += f'data items[0]/label=WXYZ\nadvance 0s\nscreenshot frames/{name}-changed.png\n'
            (path / 'commands.txt').write_text(script)
            result = subprocess.run([CLI, '.', '--commands=commands.txt'], cwd=path,
                                    text=True, capture_output=True, timeout=60)
            log = name + '-session.txt' if project == 'p7-text-run-list-controls' else 'session-' + name + '.txt'
            (path / log).write_text(result.stdout + result.stderr)
            print(project, name, result.returncode, flush=True)
            result.check_returncode()
    finally:
        (path / 'scene.rml').write_text(original)
        (path / 'commands.txt').write_text(commands)
        shutil.rmtree(path / 'build', ignore_errors=True)
        for binary in path.rglob('*.riv'):
            binary.unlink()

# Artboard-backed style handles render, but the native CLI does not expose their setter.
path = ROOT / 'p7-text-style-global-control' / 'rive'
try:
    result = subprocess.run([CLI, '.', '--commands=commands.txt'], cwd=path,
                            text=True, capture_output=True, timeout=60)
    (path / 'session.txt').write_text(result.stdout + result.stderr)
    if result.returncode != 1 or result.stdout.count('err data: style: no property at this path') != 2:
        raise RuntimeError('native style setter disposition changed; inspect the new session')
    print('p7-text-style-global-control', 'two expected setter rejections', flush=True)
finally:
    shutil.rmtree(path / 'build', ignore_errors=True)
    for binary in path.rglob('*.riv'):
        binary.unlink()

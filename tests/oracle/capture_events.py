"""Capture local CLI reports, assigning each report to its following frame dump."""
import json
import re
import subprocess
from pathlib import Path


def capture_events(project, config):
    frames = project / 'frames'
    frames.mkdir(exist_ok=True)
    try:
        result = subprocess.run(
            [str(Path.home() / '.rive/bin/rive'), '.', '--commands=commands.txt'],
            cwd=project, capture_output=True, text=True, check=True,
        )
        if 'err ' in result.stdout:
            raise RuntimeError(result.stdout + result.stderr)
        (project / 'session.txt').write_text(result.stdout + result.stderr)
        pending, events = [], []
        for line in result.stderr.splitlines():
            text = re.sub(r'^.*? rive  ', '', line)
            if text.startswith('event '):
                pending.append({'name': text[6:]})
            elif text.startswith('url '):
                pending.append({'url': text[4:]})
            marker = re.fullmatch(r'wrote frames/(\d+).json', text)
            if marker:
                frame = int(marker[1])
                dump = json.loads((frames / f'{frame}.json').read_text())
                for event in pending:
                    paths = config.get('payloadPaths', {}).get(event.get('name'), {})
                    if paths:
                        properties = {p['path']: p['value'] for p in dump['viewModel']['properties']}
                        event['payload'] = {key: properties[path] for key, path in paths.items()}
                    events.append({'frame': frame, **event})
                pending = []
        if pending:
            raise RuntimeError(f'unframed reports: {pending}')
        keep = {0, max(int(p.stem) for p in frames.glob('*.json'))}
        keep.update(event['frame'] for event in events)
        for dump in frames.glob('*.json'):
            if int(dump.stem) not in keep:
                dump.unlink()
        (project / 'events.json').write_text(json.dumps(events, indent=2) + '\n')
        return events
    finally:
        for binary in project.rglob('*.riv'):
            binary.unlink()

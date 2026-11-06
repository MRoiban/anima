#!/usr/bin/env python3
"""Independent native rounded-corner observations; local commands, no binary reads."""
import importlib.util
import json
import re
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('capture', Path(__file__).with_name('capture-leftovers.py'))
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)
for filename, previous, endpoints in [
    ('rounded', (24, 120), [(168, 120), (168, 48), (72, 168), (24, 48), (72, 0)]),
    ('rounded-angles', (24, 48), [(120, 48), (120, 96), (72, 120), (24, 96), (24, 48), (120, 0)]),
]:
    results = []
    for x, y in endpoints:
        scene = capture.wrap(
            f'<Shape><PointsPath isClosed="false"><StraightVertex x="{previous[0]}" y="{previous[1]}"/>'
            f'<StraightVertex x="72" y="48" radius="12"/><StraightVertex x="{x}" y="{y}"/>'
            '</PointsPath><Stroke thickness="6"><SolidColor colorValue="FF4263eb"/>'
            '<ScriptedPathEffect scriptAssetId="0:80"/></Stroke></Shape>'
        ).replace('<Artboard', '<ScriptAsset id="0:80" name="dump" file="dump.luau"/><Artboard')
        with tempfile.TemporaryDirectory(prefix='anima-round-') as name:
            project = Path(name)
            (project / 'rive.yaml').write_text('name: corner-probe\n')
            (project / 'scene.rml').write_text(scene)
            (project / 'dump.luau').write_text(capture.DUMP)
            (project / 'commands.txt').write_text('screenshot frame.png\n')
            log = capture.capture(project)
            lines = list(dict.fromkeys(re.findall(r'^PATH .*', log, re.M)))
            results.append({'next': [x, y], 'commands': lines})
    (Path(__file__).parent / f'probes/{filename}.json').write_text(json.dumps(results, indent=2) + '\n')

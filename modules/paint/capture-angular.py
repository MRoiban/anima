#!/usr/bin/env python3
"""Holdout seam probe: translate centre without changing the periodic ramp model."""
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('capture', Path(__file__).with_name('capture-leftovers.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
p = Path(__file__).parent / 'probes/angular-centered'
p.mkdir(exist_ok=True)
(p / 'rive.yaml').write_text('name: angular-centered-probe\n')
(p / 'scene.rml').write_text(c.wrap(c.rect(0, 0, 240, 240,
    '<Fill><AngularGradient startX="120" startY="120" endX="240" endY="120">'
    '<GradientStop colorValue="FF4263eb" position="0"/>'
    '<GradientStop colorValue="FFd97757" position="1"/></AngularGradient></Fill>')))
(p / 'commands.txt').write_text('screenshot frame.png\n')
c.capture(p)
p = Path(__file__).parent / 'probes/angular-holdout'
p.mkdir(exist_ok=True)
(p / 'rive.yaml').write_text('name: angular-ramp-holdout\n')
(p / 'scene.rml').write_text(c.wrap(c.rect(0, 0, 240, 240,
    '<Fill><AngularGradient startX="0" startY="0" endX="240" endY="0">'
    '<GradientStop colorValue="FF000000" position="0"/>'
    '<GradientStop colorValue="FFffffff" position="1"/></AngularGradient></Fill>')))
(p / 'commands.txt').write_text('screenshot frame.png\n')
c.capture(p)

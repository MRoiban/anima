"""Check retained CLI output without importing Anima internals."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
rows = [json.loads(line) for line in (ROOT / 'evidence/sample-04.jsonl').read_text().splitlines()]

def flatten(nodes):
    result = {}
    for node in nodes:
        result[node['id']] = node
        result.update(flatten(node['children']))
    return result

trees = [flatten(row['semantics']) for row in rows]
assert len(rows) == 29
initial = trees[0]
assert initial['tabs']['role'] == 'tab-list'
assert initial['generalTab']['label'] == 'General'
assert initial['generalTab']['states']['selected'] is True
assert initial['soundTab']['states']['selected'] is False
assert initial['notifications']['states']['checked'] == 'mixed'
assert 'soundPanel' not in initial
sound = trees[2]
assert sound['soundTab']['states']['selected'] is True
assert sound['soundTab']['states']['focused'] is True
assert 'generalPanel' not in sound
assert sound['volume']['role'] == 'slider'
assert (sound['volume']['min'], sound['volume']['max'], sound['volume']['step']) == (0, 100, 5)
assert (sound['volume']['value'], sound['volume']['valueText']) == (40, 'Volume 40 %')
assert (trees[4]['volume']['value'], trees[4]['volume']['valueText']) == (45, 'Volume 45 %')
assert trees[5]['volume']['value'] == 40
assert trees[7]['mute']['role'] == 'switch'
assert trees[7]['mute']['label'] == 'Mute'
assert trees[7]['mute']['states']['checked'] is True
assert trees[8]['mute']['states']['checked'] is False
parent_states = [tree['notifications']['states']['checked'] for tree in trees if 'notifications' in tree]
assert True in parent_states and False in parent_states and 'mixed' in parent_states
assert trees[11]['notifications']['states']['checked'] is True
assert trees[12]['notifications']['states']['checked'] is False
assert trees[14]['emailBox']['states']['checked'] is True
assert trees[14]['notifications']['states']['checked'] == 'mixed'
assert trees[16]['notifications']['states']['checked'] is True
assert trees[18]['notifications']['states']['checked'] is False
assert trees[26]['generalTab']['label'] == 'Preferences'
assert trees[26]['soundTab']['label'] == 'Audio'
assert trees[26]['mute']['label'] == 'Quiet'
assert trees[27]['notifications']['label'] == 'Alerts'
assert trees[27]['emailBox']['label'] == 'Mail'
assert trees[27]['pushBox']['label'] == 'Mobile'
assert trees[27]['smsBox']['label'] == 'Texts'
svg = ET.parse(ROOT / 'renamed-text.svg')
texts = [node.text for node in svg.iter() if node.tag.endswith('tspan')]
assert texts == ['Preferences', 'Audio', 'Alerts', 'Mail', 'Mobile', 'Texts', 'Level 65 %', 'Quiet']
print('PASS: 29 CLI snapshots; tab/slider/switch/checkbox semantic states; eight data-bound rendered labels.')
print('Parent checkbox semantic sequence:', parent_states)
print('Rendered label sequence:', texts)

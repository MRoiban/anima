"""Assert the recorded CLI evidence independently of runtime implementation."""
import json
import math
import wave
import xml.etree.ElementTree as ET
from pathlib import Path

here = Path(__file__).resolve().parent

def rows(name):
    return [json.loads(line) for line in (here / (name + '.stdout')).read_text().splitlines()]

def events(row, name):
    return [e for e in row['events'] if e['name'] == name]

def scales(row, expected):
    for node, value in zip(('left', 'top', 'bottom'), expected):
        assert math.isclose(row['values'][node + '.scale'], value, abs_tol=1e-9)

motion = rows('motion')
assert motion[0]['values']['count'] == 0 and motion[0]['events'] == [] and motion[0]['settled']
for row, expected in zip(motion[:9], [(1,1,1), (1,1,1), (1.1,1,1), (1.2,1.1,1),
        (1.3,1.2,1.1), (1.2,1.3,1.2), (1.1,1.2,1.3), (1,1.1,1.2), (1,1,1.1)]):
    scales(row, expected)
assert not any(events(r, 'pulse-done') for r in motion[:10])
assert events(motion[10], 'pulse-done') == [{'name':'pulse-done', 'layer':'main', 'time':0.4}]
assert motion[10]['settled'] and not motion[11]['events']
assert rows('built-motion') == motion
repeat = rows('repeat')
for n in range(1, 26):
    start, end = repeat[2*n-1:2*n+1]
    assert start['values']['count'] == n
    shared, = events(start, 'shared')
    assert shared == dict(name='shared', layer='main', time=0,
        payload=dict(count=n, channel='button'), audio='tone', volume=0.4)
    assert math.isclose(start['time'], (n-1)*0.4, abs_tol=1e-9)
    milestone = events(start, 'milestone')
    assert len(milestone) == (1 if n % 5 == 0 else 0)
    if milestone:
        assert milestone[0] == dict(name='milestone', layer='main', time=0,
            url='https://example.org/thanks', target='_blank')
    assert len(events(end, 'pulse-done')) == 1 and end['settled']
    scales(end, (1,1,1))
high = rows('high-count')[1]
assert events(high, 'shared')[0]['payload']['count'] == 1000
assert len(events(high, 'milestone')) == 1
rapid = rows('rapid')
assert events(rapid[2], 'shared')[0]['payload']['count'] == 2
scales(rapid[2], (1,1,1))
assert not any(events(r, 'pulse-done') for r in rapid[:4])
assert len(events(rapid[4], 'pulse-done')) == 1 and rapid[4]['settled']
assert rapid[5]['events'] == []
svg = ET.parse(here / 'rest.svg').getroot()
ns = '{http://www.w3.org/2000/svg}'
assert svg.attrib['viewBox'] == '0 0 20 20'
circles = list(svg.iter(ns + 'circle'))
assert [(c.attrib['cx'],c.attrib['cy'],c.attrib['r']) for c in circles] == [('5','10','2'),('15','5','2'),('15','15','2')]
assert all(c.attrib['fill'] == '#141413' for c in circles)
path, = svg.iter(ns + 'path')
assert path.attrib['d'] == 'M5 10L15 5M5 10L15 15'
assert path.attrib['stroke'] == '#141413' and path.attrib['stroke-width'] == '1.5'
assert len(list(svg)) == 4
ani = json.loads((here / 'share.ani').read_text())
assert [n['pivot'] for n in ani['nodes'][1:]] == [[5,10],[15,5],[15,15]]
with wave.open(str(here / 'tone.wav')) as tone:
    assert tone.getnchannels() == 1 and tone.getsampwidth() == 2
    assert tone.getnframes()/tone.getframerate() == 0.08
print('PASS: 84 snapshots (including built parity); pulse geometry/timing, payloads, 25 clicks, milestones through 1000, rapid restart, built parity, rest SVG, WAV structure.')
print('UNVERIFIED: browser audio playback / audible output; host opening a tab (only URL request required).')

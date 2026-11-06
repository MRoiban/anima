"""Check recorded CLI outputs independently; explicitly assert the known limit."""
import base64
import io
import json
import math
import wave
from pathlib import Path
root = Path(__file__).parent

def rows(name):
    return [json.loads(line) for line in (root / 'evidence' / (name + '.jsonl')).read_text().splitlines()]

def events(snapshot, name):
    return [e for e in snapshot['events'] if e['name'] == name]

pulse = rows('pulse')
assert pulse[0]['values']['count'] == 0 and pulse[0]['settled']
assert pulse[1]['values']['count'] == 0  # next-step listener latency is real
entry = events(pulse[2], 'shared')
assert entry == [{'name': 'shared', 'layer': 'motion', 'time': 0,
                  'payload': {'count': 1, 'channel': 'button'}, 'audio': 'tone', 'volume': 1}]
for index, name in [(5, 'left'), (6, 'upper'), (7, 'lower')]:
    assert math.isclose(pulse[index]['values'][name + '.scale'], 1.3)
assert events(pulse[-2], 'pulse-done') == [{'name': 'pulse-done', 'layer': 'motion', 'time': 0.4}]
assert pulse[-2]['settled'] and pulse[-1]['events'] == []
clicks = rows('clicks')
assert clicks == rows('built-clicks')
for number in range(1, 16):
    entry, end = clicks[number * 2 - 1:number * 2 + 1]
    shared = events(entry, 'shared')
    assert len(shared) == 1 and shared[0]['time'] == 0
    assert entry['values']['count'] == min(number, 10)
    assert shared[0]['payload'] == {'count': min(number, 10), 'channel': 'button'}
    milestone = events(entry, 'milestone')
    assert bool(milestone) == (number % 5 == 0)
    if milestone:
        assert milestone == [{'name': 'milestone', 'layer': 'fifths', 'time': 0,
                              'url': 'https://example.org/thanks', 'target': '_blank'}]
    assert events(end, 'pulse-done') == [{'name': 'pulse-done', 'layer': 'motion', 'time': 0.4}]
    assert all(end['values'][name + '.scale'] == 1 for name in ['left', 'upper', 'lower'])
    assert end['settled']
assert clicks[21]['values']['count'] == 10  # click eleven fails unbounded increment
interrupt = rows('interrupt')
assert len(events(interrupt[0], 'shared')) == len(events(interrupt[1], 'shared')) == 1
assert not events(interrupt[1], 'pulse-done')
assert events(interrupt[2], 'pulse-done')[0]['time'] == 0.4
rest = rows('rest')
assert all(s['settled'] and not s['events'] and s['values']['count'] == 0 for s in rest)
assert '0 differing pixels' in (root / 'evidence/rest-compare.json').read_text()
ani = json.loads((root / 'share.ani').read_text())
asset = ani['assets']['tone']
assert asset['type'] == 'audio' and asset['storage'] == 'embedded'
wav_bytes = base64.b64decode(asset['source'].split(',', 1)[1])
assert wav_bytes == (root / 'tone.wav').read_bytes()
with wave.open(io.BytesIO(wav_bytes)) as audio:
    assert audio.getnchannels() == 1 and audio.getsampwidth() == 2
    assert audio.getframerate() == 22050 and audio.getnframes() == 1764
    assert any(audio.readframes(1764))
print('PASS: sample evidence, payloads, 15 pulses, milestones at clicks 5/10/15, interruption, rest pixels, embedded 80 ms WAV, built/source parity.')
print('KNOWN LIMIT: count saturates at 10; shared.count therefore ceases to be a newly incremented count on click 11.')
print('UNVERIFIED: browser audio playback and host URL policy; CLI proves requests only.')

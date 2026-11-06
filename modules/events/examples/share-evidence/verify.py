"""Independent checks of committed public CLI sample output; run from any directory."""
import json
import math
import wave
from pathlib import Path

folder = Path(__file__).resolve().parent
read = lambda name: [json.loads(line) for line in (folder / name).read_text().splitlines()]
rows = read("clicks.jsonl")
assert len(rows) == 51
milestones = []
for n in range(1, 26):
    start, end = rows[2*n-1:2*n+1]
    assert start["values"]["count"] == end["values"]["count"] == n
    shared = [e for e in start["events"] if e["name"] == "shared"]
    assert len(shared) == 1 and shared[0]["time"] == 0
    assert shared[0]["payload"] == {"count": n, "channel": "button"}
    assert shared[0]["audio"] == "tone" and shared[0]["volume"] == 1
    done = [e for e in end["events"] if e["name"] == "pulse-done"]
    assert len(done) == 1 and done[0]["time"] == 0.4
    assert math.isclose(end["time"] - start["time"], 0.4)
    assert end["settled"] and end["states"]["motion"] == "rest"
    hits = [e for e in start["events"] if e["name"] == "milestone"]
    assert len(hits) == (n % 5 == 0)
    for event in hits:
        assert event["url"] == "https://example.org/thanks" and event["target"] == "_blank"
        milestones.append(n)
assert milestones == [5, 10, 15, 20, 25]
for row in read("pulse.jsonl"):
    for name, delay in [("left", 0), ("upper", 0.05), ("lower", 0.1)]:
        local = row["time"] - delay
        expected = 1 if local <= 0 or local >= 0.3 else 1 + 0.3 * (1 - abs(local - 0.15)/0.15)
        assert math.isclose(row["values"][name + ".scale"], expected, abs_tol=1e-9)
interrupted = read("interrupt.jsonl")
assert [r["values"]["count"] for r in interrupted] == [1, 2, 2]
assert sum(e["name"] == "pulse-done" for r in interrupted for e in r["events"]) == 1
scene = json.loads((folder.parent / "share.ani").read_text())
assert scene["grid"] == 20 and scene["colors"]["ink"] == "#141413"
assert len(scene["nodes"]) == 4
assert scene["nodes"][0]["d"] == "M5 10L15 5M5 10L15 15"
assert scene["nodes"][0]["stroke"] == {"color": "ink", "width": 1.5}
for node, center in zip(scene["nodes"][1:], [[5,10], [15,5], [15,15]]):
    assert node["r"] == 2 and node["center"] == node["pivot"] == center
    assert node["fill"] == {"color": "ink"}
with wave.open(str(folder.parent / "share-tone.wav")) as sound:
    assert sound.getnchannels() == 1 and sound.getsampwidth() == 2
    assert sound.getnframes()/sound.getframerate() == 0.08
print("share: 6/6 requests + geometry verified; 25 increments, milestones 5/10/15/20/25, 25 shared + 25 pulse-done, 10 pulse samples; audio host path requires events browser test")

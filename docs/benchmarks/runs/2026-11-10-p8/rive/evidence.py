#!/usr/bin/env python3
import math
import re
from pathlib import Path

ROOT = Path(__file__).parent
LOG = ROOT / "evidence" / "runtime.log"
SHOULDER = (8.0, 20.0)
EYE = (32.0, 6.0)
POINTERS = [(22.0, 12.0), (14.0, 26.0), (39.0, 2.0), (2.0, 20.0)]

pattern = re.compile(
    r"PROOF (?P<label>\S+) hand=\((?P<hx>-?\d+\.\d+),(?P<hy>-?\d+\.\d+)\) "
    r"elbow=\((?P<ex>-?\d+\.\d+),(?P<ey>-?\d+\.\d+)\) "
    r"pupil=\((?P<px>-?\d+\.\d+),(?P<py>-?\d+\.\d+)\) "
    r"sleeve=(?P<sleeve>.+)$"
)

rows = []
for line in LOG.read_text().splitlines():
    m = pattern.match(line)
    if not m:
        continue
    sleeve = []
    for pair in m.group("sleeve").split("|"):
        x, y = pair.strip("()").split(",")
        sleeve.append((float(x), float(y)))
    rows.append({
        "label": m.group("label"),
        "hand": (float(m.group("hx")), float(m.group("hy"))),
        "elbow": (float(m.group("ex")), float(m.group("ey"))),
        "pupil": (float(m.group("px")), float(m.group("py"))),
        "sleeve": sleeve,
    })

def dist(a, b):
    return math.hypot(a[0]-b[0], a[1]-b[1])

def cross(a, b):
    return a[0]*b[1] - a[1]*b[0]

def first(label):
    for row in rows:
        if row["label"] == label:
            return row
    raise SystemExit(f"missing proof row: {label}")

print("Rive runtime proof, grid units")
rest = first("rest")
print(f"rest hand={rest['hand']} elbow={rest['elbow']} pupil={rest['pupil']} sleeve_points={len(rest['sleeve'])}")

for target in POINTERS:
    label = f"pointer({target[0]:.4f},{target[1]:.4f})"
    row = first(label)
    upper = dist(SHOULDER, row["elbow"])
    fore = dist(row["elbow"], row["hand"])
    hv = (row["hand"][0]-SHOULDER[0], row["hand"][1]-SHOULDER[1])
    ev = (row["elbow"][0]-SHOULDER[0], row["elbow"][1]-SHOULDER[1])
    side = cross(hv, ev)
    pupil_r = dist(EYE, row["pupil"])
    target_d = dist(SHOULDER, target)
    hand_err = dist(row["hand"], target)
    line_cross = cross((target[0]-SHOULDER[0], target[1]-SHOULDER[1]), hv)
    print(
        f"{label}: hand={row['hand']} elbow={row['elbow']} pupil={row['pupil']} "
        f"upper={upper:.4f} fore={fore:.4f} right_side_cross={side:.4f} "
        f"pupil_offset={pupil_r:.4f} target_distance={target_d:.4f} hand_error={hand_err:.4f} "
        f"hand_distance={dist(SHOULDER,row['hand']):.4f} line_cross={line_cross:.4f}"
    )
    print("  sleeve=" + " ".join(f"({x:.4f},{y:.4f})" for x,y in row["sleeve"]))

release = [row for row in rows if row["label"].startswith("leave@")]
release.sort(key=lambda row: float(row["label"].split("@", 1)[1]))
for t in (0.0, 0.2, 0.4):
    row = first(f"leave@{t:.4f}")
    print(f"leave@{t:.1f}: hand={row['hand']} elbow={row['elbow']} pupil={row['pupil']}")

steps = [dist(release[i-1]["hand"], release[i]["hand"]) for i in range(1, len(release))]
expected = dist(release[0]["hand"], release[-1]["hand"]) / 24.0
mid = first("leave@0.2000")["hand"]
mid_expected = (
    (release[0]["hand"][0] + release[-1]["hand"][0]) / 2,
    (release[0]["hand"][1] + release[-1]["hand"][1]) / 2,
)
print(
    f"release_samples={len(release)} hand_step_min={min(steps):.4f} "
    f"hand_step_max={max(steps):.4f} expected_linear_step={expected:.4f} "
    f"midpoint_error={dist(mid,mid_expected):.4f}"
)

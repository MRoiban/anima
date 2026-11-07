"""Assert CLI-produced trees and data; run from the project root."""
import json
from pathlib import Path

EVIDENCE = Path(__file__).parent / "evidence"
checks = 0


def data(name):
    payload = json.loads((EVIDENCE / (name + ".data.json")).read_text())
    return {p["name"]: p["value"] for p in payload["viewModel"]["properties"]}


def nodes(name):
    result = []

    def visit(node):
        result.append(node)
        for child in node["children"]:
            visit(child)

    for root in json.loads((EVIDENCE / (name + ".tree.json")).read_text())["roots"]:
        visit(root)
    return result


def node(name, label):
    return next(n for n in nodes(name) if n["label"] == label)


def expect(condition, message):
    global checks
    assert condition, message
    checks += 1
    print("PASS", message)


initial = data("00-initial")
for key, value in {"volume": 40, "muted": False, "selectedTab": "General",
                   "email": True, "push": False, "sms": False}.items():
    expect(initial[key] == value, "default " + key)
expect(node("00-initial", "Settings tabs")["role"] == "tabList", "tab list role")
for name, selected, absent in [("00-initial", "General", "Volume"),
                              ("01-arrow-sound", "Sound", "Notifications"),
                              ("06-arrow-general", "General", "Volume")]:
    expect(node(name, selected)["stateFlags"] & 2, name + " selected tab")
    expect(absent not in [n["label"] for n in nodes(name)], name + " inactive panel absent")
for name, expected in [("02-slider-increase", 45), ("03-slider-decrease", 40),
                       ("25-increase-clamped", 100), ("27-decrease-clamped", 0),
                       ("43-slider-key-right", 45), ("44-slider-key-left", 40)]:
    expect(data(name)["volume"] == expected, name + " volume data")
    expect(node(name, "Volume")["value"] == f"Volume {expected} %", name + " spoken value")
    expect(node(name, "Volume")["role"] == "slider", name + " slider role")
for name, expected in [("04-mute-on", True), ("05-mute-off", False),
                       ("45-mute-key-focus", True), ("46-mute-key-space", False)]:
    expect(data(name)["muted"] == expected, name + " mute data")
    expect(bool(node(name, "Mute")["stateFlags"] & 16) == expected, name + " toggle semantics")
    expect(data(name)["knobX"] == (54 if expected else 18), name + " knob binding source")
for name, expected in [("00-initial", 2), ("07-parent-all", 1), ("08-parent-none", 0),
                       ("09-email-on", 2), ("10-push-on", 2), ("11-sms-on", 1),
                       ("12-email-off", 2), ("33-parent-from-mixed", 1),
                       ("34-parent-clear", 0), ("35-parent-from-none", 1),
                       ("51-parent-focus-click", 1), ("52-parent-key-space", 0),
                       ("53-child-focus-click", 2), ("54-child-key-space", 0)]:
    expect(data(name)["parentState"] == expected, name + " parent data")
    expect((node(name, "Notifications")["stateFlags"] >> 2) & 3 == expected, name + " tri-state semantics")
    for child in ["email", "push", "sms"]:
        expect(bool(node(name, child.capitalize() if child != "sms" else "SMS")["stateFlags"] & 4)
               == data(name)[child], name + " child " + child)
expect(node("30-renamed-tab", "Audio")["role"] == "tab", "host-written sound title")
expect(node("31-renamed-general", "Preferences")["role"] == "tab", "host-written general title")
expect(data("32-select-renamed")["selectedTab"] == "General", "action addresses renamed tab")
expect(data("21-pointer-sound")["selectedTab"] == "Sound", "pointer selects Sound")
expect(data("22-semantic-general")["selectedTab"] == "General", "semantic selects General")
expect(data("23-semantic-sound")["selectedTab"] == "Sound", "semantic selects Sound")
expect(data("41-host-selected-tab")["selectedTab"] == "Sound", "host selects tab")
expect(data("55-host-volume-too-high")["volume"] == 100, "host volume upper clamp")
expect(data("56-host-volume-too-low")["volume"] == 0, "host volume lower clamp")
for f in EVIDENCE.glob("capture-*.txt"):
    expect(not any(line.startswith("err ") for line in f.read_text().splitlines()) and "error   " not in f.read_text(), f.name + " no command/build errors")
print(f"{checks} assertions passed")

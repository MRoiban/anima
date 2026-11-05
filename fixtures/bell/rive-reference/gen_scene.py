#!/usr/bin/env python3
"""Build scene.rml for the ringing bell from icons/glyphs/bell.svg.

The Rive CLI has no SVG import, so this converts the glyph's path (absolute
M/L/C/Z only, as Glyphy writes it) into PointsPath vertices, then lays out the
scene, the Ring / Hover animations and the state machine around them.

    python3 gen_scene.py            # rewrites scene.rml next to this file
"""
import math
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
GLYPH = HERE.parents[1] / "icons" / "glyphs" / "bell.svg"

ART = 240          # artboard size, px
SCALE = 10         # glyph units -> px (20-unit grid -> 200 px)
INK = "FF141413"   # Anthropic slate; the page rebinds these for dark mode
PAPER = "FFFAF9F5"
CLAY = "FFD97757"

# Pivots, in glyph units
SWING = (10.0, 2.5)    # top of the bell's handle
CLAPPER = (10.0, 9.0)  # inside the bell, above the clapper
WAVES = (10.0, 7.0)    # centre of the sound arcs, level with the shoulders
DOT = (14.9, 4.6)      # notification dot

_ids = iter(range(10, 10_000))


def nid():
    return f"0:{next(_ids)}"


def u(v):
    """Glyph units -> artboard px. Geometry is written in pixels so stroke
    thickness and node positions read the same in the editor as on screen."""
    return f(v * SCALE)


def f(v):
    return f"{v:.4f}".rstrip("0").rstrip(".") if v != int(v) else str(int(v))


# ---------------------------------------------------------------- the glyph

def parse_contours(d):
    """Split an absolute M/L/C/Z path into contours of segments."""
    toks = re.findall(r"[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    contours, cur, pen, i, cmd = [], None, None, 0, None
    while i < len(toks):
        t = toks[i]
        if t in "MLCZ":
            cmd = t
            i += 1
            if cmd == "Z":
                contours.append(cur)
                cur = None
            continue
        n = {"M": 2, "L": 2, "C": 6}[cmd]
        v = list(map(float, toks[i:i + n]))
        i += n
        if cmd == "M":
            pen = (v[0], v[1])
            cur = {"start": pen, "segs": []}
            cmd = "L"  # implicit lineto after moveto
        elif cmd == "L":
            cur["segs"].append(("L", pen, (v[0], v[1])))
            pen = (v[0], v[1])
        else:
            cur["segs"].append(("C", pen, (v[0], v[1]), (v[2], v[3]), (v[4], v[5])))
            pen = (v[4], v[5])
    if cur:
        contours.append(cur)
    return contours


def contour_vertices(c):
    """One vertex per segment start, with in/out handles in absolute coords."""
    segs = list(c["segs"])
    start = c["start"]
    # Drop a final segment that is a zero-length return to the start.
    if segs and segs[-1][0] == "L" and math.dist(segs[-1][2], start) < 1e-6:
        segs.pop()
    # Close: if the last segment does not end on the start, Z adds a line.
    end = segs[-1][-1]
    if math.dist(end, start) > 1e-6:
        segs.append(("L", end, start))
    n = len(segs)
    verts = []
    for k, s in enumerate(segs):
        prev = segs[k - 1]
        p = s[1]
        h_in = prev[3] if prev[0] == "C" else None   # 2nd control of the incoming curve
        h_out = s[2] if s[0] == "C" else None        # 1st control of the outgoing curve
        verts.append((p, h_in, h_out))
    assert len(verts) == n
    return verts


def vertex_xml(p, h_in, h_out, ox, oy):
    x, y = p[0] - ox, p[1] - oy
    if h_in is None and h_out is None:
        return f'<StraightVertex x="{u(x)}" y="{u(y)}"/>'

    def polar(h):
        if h is None:
            return 0.0, 0.0
        dx, dy = h[0] - p[0], h[1] - p[1]
        return math.atan2(dy, dx), math.hypot(dx, dy)

    ir, idist = polar(h_in)
    orot, odist = polar(h_out)
    return (f'<CubicDetachedVertex x="{u(x)}" y="{u(y)}" inRotation="{f(ir)}" '
            f'inDistance="{u(idist)}" outRotation="{f(orot)}" outDistance="{u(odist)}"/>')


def points_path(c, ox, oy, name, indent):
    pad = " " * indent
    inner = "\n".join(pad + "    " + vertex_xml(*v, ox, oy) for v in contour_vertices(c))
    return f'{pad}<PointsPath isClosed="true" name="{name}">\n{inner}\n{pad}</PointsPath>'


# ------------------------------------------------------------ small helpers

def arc_path(r, a0, a1, mirror, name, indent):
    """An open circular arc of radius r from angle a0 to a1 (radians, y down),
    as one cubic segment. Mirrored arcs face left."""
    sx = -1 if mirror else 1
    k = 4 / 3 * math.tan((a1 - a0) / 4) * r
    p0 = (sx * r * math.cos(a0), r * math.sin(a0))
    p1 = (sx * r * math.cos(a1), r * math.sin(a1))
    # tangents along the direction of travel
    t0 = (sx * -math.sin(a0), math.cos(a0))
    t1 = (sx * -math.sin(a1), math.cos(a1))
    out0 = math.atan2(t0[1], t0[0])
    in1 = math.atan2(-t1[1], -t1[0])
    pad = " " * indent
    return (f'{pad}<PointsPath name="{name}">\n'
            f'{pad}    <CubicDetachedVertex x="{u(p0[0])}" y="{u(p0[1])}" inRotation="0" inDistance="0" '
            f'outRotation="{f(out0)}" outDistance="{u(k)}"/>\n'
            f'{pad}    <CubicDetachedVertex x="{u(p1[0])}" y="{u(p1[1])}" inRotation="{f(in1)}" '
            f'inDistance="{u(k)}" outRotation="0" outDistance="0"/>\n'
            f'{pad}</PointsPath>')


EASE_IO = '<CubicEaseInterpolator x1="0.45" y1="0" x2="0.55" y2="1"/>'
EASE_OUT = '<CubicEaseInterpolator x1="0.2" y1="0" x2="0.3" y2="1"/>'
EASE_IN = '<CubicEaseInterpolator x1="0.6" y1="0" x2="0.9" y2="0.6"/>'


def keys(prop, frames, ease=EASE_IO, first=None):
    """frames: [(frame, value)], eased per segment, the last key holds."""
    out = [f'            <KeyedProperty property="{prop}">']
    for j, (fr, v) in enumerate(frames):
        if j == len(frames) - 1:
            out.append(f'                <KeyFrameDouble frame="{fr}" value="{f(v)}" interpolationType="hold"/>')
            continue
        e = first if (j == 0 and first) else ease
        if e == "hold":
            out.append(f'                <KeyFrameDouble frame="{fr}" value="{f(v)}" interpolationType="hold"/>')
        elif e.startswith("<Elastic"):
            out.append(f'                <KeyFrameDouble frame="{fr}" value="{f(v)}" interpolationType="elastic">'
                       f'{e}</KeyFrameDouble>')
        else:
            out.append(f'                <KeyFrameDouble frame="{fr}" value="{f(v)}" interpolationType="cubic">'
                       f'{e}</KeyFrameDouble>')
    out.append('            </KeyedProperty>')
    return "\n".join(out)


def keyed(obj, *props):
    return (f'        <KeyedObject objectId="{obj}">\n' + "\n".join(props) +
            '\n        </KeyedObject>')


def anim(name, aid, duration, body, loop="oneShot"):
    return (f'    <LinearAnimation loopValue="{loop}" fps="60" duration="{duration}" name="{name}" id="{aid}">\n'
            + "\n".join(body) + '\n    </LinearAnimation>')


# ------------------------------------------------------------------ build

def build():
    d = re.search(r' d="([^"]+)"', GLYPH.read_text()).group(1)
    contours = parse_contours(d)
    assert len(contours) == 3, f"expected body, hollow and clapper, got {len(contours)}"
    # Largest bbox = outer body; the one lowest down = clapper.
    def bbox(c):
        pts = [c["start"]] + [s[-1] for s in c["segs"]]
        xs, ys = zip(*pts)
        return min(xs), min(ys), max(xs), max(ys)
    clapper = max(contours, key=lambda c: bbox(c)[1])
    body = [c for c in contours if c is not clapper]

    ids = {k: nid() for k in [
        "artboard", "style", "sm", "vm", "vmi", "p_ring", "p_hover", "p_down", "p_ink", "p_paper", "p_accent",
        "hit", "hover", "icon", "swing", "body", "clapper_pivot", "clapper", "dot",
        "waves", "w_r1", "w_r2", "w_l1", "w_l2",
        "c_ink_body", "c_ink_clapper", "c_dot", "c_dot_ring",
        "a_idle", "a_ring", "a_rested", "a_rest", "a_hover", "a_press",
        "l_ring", "s_idle", "s_ring", "s_rested", "l_hover", "s_rest", "s_hover", "s_press",
    ]}
    vm, P = ids["vm"], ids
    path = lambda prop: f"{vm}-{P[prop]}"

    def color_bind(prop):
        return f'<DataBindContext sourcePathIds="{path(prop)}" propertyKey="37"/>'

    ox, oy = SWING[0], SWING[1]  # body shape sits at the swing pivot
    body_paths = "\n".join(points_path(c, ox, oy, f"Contour {i + 1}", 20) for i, c in enumerate(body))
    clapper_path = points_path(clapper, CLAPPER[0], CLAPPER[1], "Clapper", 24)

    wave_shapes = []
    # Short arcs off the shoulders, clear of the swinging rim (which reaches
    # about 3 units sideways at full swing).
    for key, r, mirror in [("w_r1", 6.6, False), ("w_r2", 8.2, False),
                           ("w_l1", 6.6, True), ("w_l2", 8.2, True)]:
        a0, a1 = math.radians(-46), math.radians(-18)
        wave_shapes.append(f'''            <Node opacity="0" name="{key}" id="{P[key]}">
                <Shape name="Arc">
{arc_path(r, a0, a1, mirror, "Path", 20)}
                    <Stroke thickness="{u(1)}" cap="round" join="round" name="Stroke">
                        <SolidColor colorValue="{INK}" name="Ink">{color_bind("p_ink")}</SolidColor>
                    </Stroke>
                </Shape>
            </Node>''')

    dx, dy = DOT[0] - SWING[0], DOT[1] - SWING[1]
    scene = f'''<Rive version="1" kind="fragment">
    <!-- Generated by gen_scene.py from icons/glyphs/bell.svg. Edit the script, not this file. -->
    <Artboard viewModelId="{vm}" defaultStateMachineId="{P["sm"]}" styleId="{P["style"]}" width="{ART}" height="{ART}" name="Bell" id="{P["artboard"]}">
        <LayoutComponentStyle name="Artboard Style" id="{P["style"]}"/>

    <!-- Draw order: first declared paints on top. -->
    <Node x="{ART / 2}" y="{ART / 2}" name="Hover" id="{P["hover"]}">
        <Node name="Icon" id="{P["icon"]}">
            <Node x="{u(WAVES[0] - 10)}" y="{u(WAVES[1] - 10)}" name="Waves" id="{P["waves"]}">
{chr(10).join(wave_shapes)}
            </Node>
            <Node x="{u(SWING[0] - 10)}" y="{u(SWING[1] - 10)}" name="Swing" id="{P["swing"]}">
                <!-- The cutout is a paper-coloured disc behind the dot, not an
                     outside stroke: web runtimes ignore Stroke.position. -->
                <Node x="{u(dx)}" y="{u(dy)}" scaleX="0" scaleY="0" name="Dot" id="{P["dot"]}">
                    <Shape name="Badge">
                        <Ellipse width="{u(3.0)}" height="{u(3.0)}" originX="0.5" originY="0.5" name="Path"/>
                        <Fill name="Fill">
                            <SolidColor colorValue="{CLAY}" name="Accent" id="{P["c_dot"]}">{color_bind("p_accent")}</SolidColor>
                        </Fill>
                    </Shape>
                    <Shape name="Cutout">
                        <Ellipse width="{u(5.4)}" height="{u(5.4)}" originX="0.5" originY="0.5" name="Path"/>
                        <Fill name="Fill">
                            <SolidColor colorValue="{PAPER}" name="Paper" id="{P["c_dot_ring"]}">{color_bind("p_paper")}</SolidColor>
                        </Fill>
                    </Shape>
                </Node>
                <Shape name="Body" id="{P["body"]}">
{body_paths}
                    <Fill fillRule="evenOdd" name="Fill">
                        <SolidColor colorValue="{INK}" name="Ink" id="{P["c_ink_body"]}">{color_bind("p_ink")}</SolidColor>
                    </Fill>
                </Shape>
                <Node x="{u(CLAPPER[0] - SWING[0])}" y="{u(CLAPPER[1] - SWING[1])}" name="Clapper Pivot" id="{P["clapper_pivot"]}">
                    <Shape name="Clapper" id="{P["clapper"]}">
{clapper_path}
                        <Fill fillRule="evenOdd" name="Fill">
                            <SolidColor colorValue="{INK}" name="Ink" id="{P["c_ink_clapper"]}">{color_bind("p_ink")}</SolidColor>
                        </Fill>
                    </Shape>
                </Node>
            </Node>
        </Node>
    </Node>

    <!-- Hit area: a transparent disc the listeners watch. -->
    <Shape x="{ART / 2}" y="{ART / 2}" name="Hit" id="{P["hit"]}">
        <Ellipse width="{ART - 24}" height="{ART - 24}" originX="0.5" originY="0.5" name="Path"/>
        <Fill name="Fill"><SolidColor colorValue="00000000" name="Clear"/></Fill>
    </Shape>

{state_machine(P, path)}

{animations(P)}
    </Artboard>

    <ViewModel defaultInstanceId="{P["vmi"]}" name="Bell" id="{vm}">
        <ViewModelPropertyTrigger name="ring" id="{P["p_ring"]}"/>
        <ViewModelPropertyBoolean name="hover" id="{P["p_hover"]}"/>
        <ViewModelPropertyBoolean name="down" id="{P["p_down"]}"/>
        <ViewModelPropertyColor name="ink" id="{P["p_ink"]}"/>
        <ViewModelPropertyColor name="paper" id="{P["p_paper"]}"/>
        <ViewModelPropertyColor name="accent" id="{P["p_accent"]}"/>
        <ViewModelInstance exports="true" name="Default" id="{P["vmi"]}">
            <ViewModelInstanceTrigger viewModelPropertyId="{P["p_ring"]}"/>
            <ViewModelInstanceBoolean propertyValue="false" viewModelPropertyId="{P["p_hover"]}"/>
            <ViewModelInstanceBoolean propertyValue="false" viewModelPropertyId="{P["p_down"]}"/>
            <ViewModelInstanceColor propertyValue="{INK}" viewModelPropertyId="{P["p_ink"]}"/>
            <ViewModelInstanceColor propertyValue="{PAPER}" viewModelPropertyId="{P["p_paper"]}"/>
            <ViewModelInstanceColor propertyValue="{CLAY}" viewModelPropertyId="{P["p_accent"]}"/>
        </ViewModelInstance>
    </ViewModel>
</Rive>
'''
    return scene


def write_bool(path_ids, value):
    return f'''            <ListenerViewModelChange>
                <BindablePropertyBoolean propertyValue="{value}">
                    <DataBindContext sourcePathIds="{path_ids}" propertyKey="634" direction="true"/>
                </BindablePropertyBoolean>
            </ListenerViewModelChange>'''


def bool_is(path_ids, value):
    return f'''<TransitionViewModelCondition>
                        <TransitionPropertyViewModelComparator>
                            <BindablePropertyBoolean>
                                <DataBindContext sourcePathIds="{path_ids}" propertyKey="634"/>
                            </BindablePropertyBoolean>
                        </TransitionPropertyViewModelComparator>
                        <TransitionValueBooleanComparator value="{value}"/>
                    </TransitionViewModelCondition>'''


def trigger_fired(path_ids):
    return f'''<TransitionViewModelCondition>
                        <TransitionPropertyViewModelComparator>
                            <BindablePropertyTrigger>
                                <DataBindContext sourcePathIds="{path_ids}" propertyKey="686"/>
                            </BindablePropertyTrigger>
                        </TransitionPropertyViewModelComparator>
                        <TransitionValueTriggerComparator/>
                    </TransitionViewModelCondition>'''


def state_machine(P, path):
    hit = P["hit"]
    ring, hover, down = path("p_ring"), path("p_hover"), path("p_down")
    to = lambda s, cond="", dur=0, extra="": (
        f'                <StateTransition stateToId="{P[s]}" duration="{dur}"{extra}>'
        + (f'\n                    {cond}\n                ' if cond else '') + '</StateTransition>')
    done = ' enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"'
    return f'''    <StateMachine name="Bell" id="{P["sm"]}">
        <StateMachineListenerSingle targetId="{hit}" listenerTypeValue="click" name="Ring">
            <ListenerViewModelChange>
                <BindablePropertyTrigger propertyValue="1">
                    <DataBindContext sourcePathIds="{ring}" propertyKey="686" direction="true"/>
                </BindablePropertyTrigger>
            </ListenerViewModelChange>
        </StateMachineListenerSingle>
        <StateMachineListenerSingle targetId="{hit}" listenerTypeValue="enter" name="In">
{write_bool(hover, "true")}
        </StateMachineListenerSingle>
        <StateMachineListenerSingle targetId="{hit}" listenerTypeValue="exit" name="Out">
{write_bool(hover, "false")}
{write_bool(down, "false")}
        </StateMachineListenerSingle>
        <StateMachineListenerSingle targetId="{hit}" listenerTypeValue="down" name="Press">
{write_bool(down, "true")}
        </StateMachineListenerSingle>
        <StateMachineListenerSingle targetId="{hit}" listenerTypeValue="up" name="Release">
{write_bool(down, "false")}
        </StateMachineListenerSingle>

        <StateMachineLayer name="Ring" id="{P["l_ring"]}">
            <AnyState x="0" y="-120"/>
            <ExitState x="400" y="-120"/>
            <EntryState x="-200" y="0">
                <StateTransition stateToId="{P["s_idle"]}"/>
            </EntryState>
            <AnimationState x="0" y="0" animationId="{P["a_idle"]}" id="{P["s_idle"]}">
{to("s_ring", trigger_fired(ring))}
            </AnimationState>
            <AnimationState x="200" y="0" reset="true" animationId="{P["a_ring"]}" id="{P["s_ring"]}">
{to("s_rested", extra=done)}
            </AnimationState>
            <AnimationState x="400" y="0" animationId="{P["a_rested"]}" id="{P["s_rested"]}">
{to("s_ring", trigger_fired(ring))}
            </AnimationState>
        </StateMachineLayer>

        <StateMachineLayer name="Hover" id="{P["l_hover"]}">
            <AnyState x="0" y="-120"/>
            <ExitState x="400" y="-120"/>
            <EntryState x="-200" y="0">
                <StateTransition stateToId="{P["s_rest"]}"/>
            </EntryState>
            <AnimationState x="0" y="0" animationId="{P["a_rest"]}" id="{P["s_rest"]}">
{to("s_hover", bool_is(hover, "true"), 180)}
            </AnimationState>
            <AnimationState x="200" y="0" animationId="{P["a_hover"]}" id="{P["s_hover"]}">
{to("s_rest", bool_is(hover, "false"), 220)}
{to("s_press", bool_is(down, "true"), 90)}
            </AnimationState>
            <AnimationState x="200" y="160" animationId="{P["a_press"]}" id="{P["s_press"]}">
{to("s_hover", bool_is(down, "false"), 160)}
{to("s_rest", bool_is(hover, "false"), 220)}
            </AnimationState>
        </StateMachineLayer>
    </StateMachine>'''


def animations(P):
    DOT_POP = '<ElasticInterpolator easingValue="easeOut" amplitude="1" period="0.45"/>'
    swing = [(0, 0), (7, 0.30), (17, -0.24), (27, 0.16), (37, -0.10), (47, 0.055), (57, -0.02), (66, 0)]
    clap = [(0, 0), (5, -0.12), (13, 0.17), (23, -0.13), (33, 0.09), (43, -0.05), (53, 0.02), (63, 0)]
    ring_body = [
        keyed(P["swing"], keys("rotation", swing, first=EASE_OUT)),
        keyed(P["clapper_pivot"], keys("rotation", clap, first=EASE_OUT)),
        keyed(P["dot"],
              keys("scaleX", [(0, 0), (40, 0), (58, 1), (84, 1)], first="hold", ease=DOT_POP),
              keys("scaleY", [(0, 0), (40, 0), (58, 1), (84, 1)], first="hold", ease=DOT_POP)),
    ]
    # Sound arcs: the inner pair leads, the outer pair follows.
    for key, t0 in [("w_r1", 1), ("w_l1", 1), ("w_r2", 7), ("w_l2", 7)]:
        ring_body.append(keyed(
            P[key],
            keys("opacity", [(0, 0), (t0, 0), (t0 + 7, 1), (t0 + 30, 0)], first="hold", ease=EASE_OUT),
            keys("scaleX", [(0, 0.82), (t0, 0.82), (t0 + 30, 1.08)], first="hold", ease=EASE_OUT),
            keys("scaleY", [(0, 0.82), (t0, 0.82), (t0 + 30, 1.08)], first="hold", ease=EASE_OUT),
        ))

    def pose(obj, **props):
        return keyed(obj, *[
            f'            <KeyedProperty property="{k}"><KeyFrameDouble frame="0" value="{f(v)}"/></KeyedProperty>'
            for k, v in props.items()])

    return "\n\n".join([
        anim("Idle", P["a_idle"], 1, [pose(P["dot"], scaleX=0, scaleY=0)]),
        anim("Ring", P["a_ring"], 84, ring_body),
        anim("Rested", P["a_rested"], 1, [pose(P["dot"], scaleX=1, scaleY=1)]),
        anim("Rest", P["a_rest"], 1, [pose(P["hover"], scaleX=1, scaleY=1, rotation=0)]),
        anim("Hover", P["a_hover"], 1, [pose(P["hover"], scaleX=1.05, scaleY=1.05, rotation=-0.035)]),
        anim("Press", P["a_press"], 1, [pose(P["hover"], scaleX=0.95, scaleY=0.95, rotation=-0.015)]),
    ])


if __name__ == "__main__":
    out = HERE / "scene.rml"
    out.write_text(build())
    print(f"wrote {out}")

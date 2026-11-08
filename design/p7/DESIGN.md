# P7 design: minimal layout, host fit, bindable artboards

Decided by the orchestrator (2026-11-08) for the 57 P7 rows (`docs/parity/inventory.json`, phase P7):
34 layout and host-fit rows, `data.bind-layout`, the four bindable-artboard rows moved from P3c, and
the 18 P6 text carry-overs (`docs/parity/P6-closure.md`). Constraints: the owner's triage (minimal
layout: hug, padding, min/max, fixed, row/column stacks, host fit; animated reflow brought back),
the size gates (final through P8), and the standing rules (benchmark, sizes, compile/frame cost,
definition of done per capability). Decisions not on the owner's ask list are logged in WORKLOG as
"decided, owner may revisit". Coders implement it; a needed deviation is raised with its reason.

## 1. Targets and guards

| Metric | Command | Baseline (main 8ffd714) | Target / guard |
|---|---|---:|---|
| app-UI scene (adds `layout`, `layout-reflow`, `host-fit`) | `node tools/size.ts` | 98,890 B | ≤ 131,072 B; expected ≈ 105 KB |
| each scene | `node tools/size.ts` | largest 53,857 B | ≤ 65,536 B |
| core + web | `node tools/size.ts` | 21,136 B | ≤ 24,576 B; layout and fit add nothing to core + web |
| runtime sum | `node tools/size.ts` | 120,281 B | ≤ 163,840 B |
| authoring add-on | `node tools/size.ts` | 14,717 B | ≤ 15,360 B (my cap) |
| Rive-class | `node tools/size.ts` | 130,077 B | ≤ 256,000 B |
| `text` entry | `node tools/size.ts` | 6,144 / 6,144 B | ≤ 5,632 B after the split (P7-1) |
| frame / compile cost of pages without layout | perf A/B vs main (pinned, minimums) | — | within noise (≤ 3 %) |
| benchmark | §9 | — | AniML ≥ Rive on the layout brief; no regression on earlier briefs |

## 2. Modules and budgets

| Entry | Class | Holds | Budget |
|---|---|---|---:|
| `layout` | runtime | `<layout>` containers, child sizing (fixed, hug, fill weights), min/max, direction (+ reverse), justify, align-items, align-self, gap, padding, margin, display none, participants (shapes, images, text, instances), intrinsic sizing, layout paint, bindable layout values | 4,096 B |
| `layout-reflow` | runtime | animated reflow: interpolating changed boxes with inherited or per-child duration and easing | 1,024 B |
| `host-fit` | runtime (web) | `fit` (contain, cover, fill, fit-width, fit-height, none, scale-down, layout) and nine-point `alignment` on `<anima-icon>`, artboard size read/set/reset | 768 B |
| `markup-layout` | authoring | AniML spellings for the above | 512 B |
| `data-artboard` | runtime | bindable artboards: a model property of type `artboard` naming a component, assigned by data, binding or host API, including components from another loaded document | 1,024 B |
| `text` split (P7-1) | runtime | move canvas text drawing and fit-font-size bisection into optional entries | `text` ≤ 5,632 B |

`markup` (7,341 B) and `markup-libraries` (2,176/2,176) must not grow: every new AniML spelling lives
in `markup-layout` (or the artboard ticket's own markup entry).

## 3. The layout model (authoring)

```xml
<layout id="card" x="2" y="2" width="hug" height="hug" direction="column" gap="1" padding="1"
        align="start" justify="start" fill="#f0eee6" corners="1" reflow="0.25 ease-out">
  <text id="title" layout-width="fill" ...>…</text>
  <layout id="row" direction="row" gap="0.5" align="center" layout-width="fill">
    <rect id="icon" width="2" height="2" .../>
    <text id="label" layout-width="hug" min-width="4" max-width="20" .../>
    <rect id="spacer" layout-width="fill(1)" height="0"/>
    <instance id="badge" component="badge" align-self="end" margin="0 0 0 0.5"/>
  </layout>
</layout>
```

- **Container** (`layout` node): `direction` row | column | row-reverse | column-reverse; `justify`
  start | center | end | space-between | space-around | space-evenly; `align` (cross axis) start |
  center | end | stretch | baseline; `gap` (main, or `gap="row column"`); `padding` (1–4 values);
  `width`/`height` a number (fixed), `hug` or `fill(weight)`; `min-*`/`max-*`; paint like a rect
  (`fill`, `stroke`, `corners`) drawn as the box (`layout.paint`); `reflow` duration + ease (inherited).
- **Children** of a container participate: `layout-width`/`layout-height` (fixed number, `hug`,
  `fill`/`fill(w)`), `min-*`/`max-*`, `align-self`, `margin` (1–4 values), `display="none"` (out of
  layout and drawing), `reflow` override. Shapes contribute their authored size; text its measured
  size from the text layout (P7-1 exposes `measureText(node, maxWidth)` through the text module's
  existing measurer contract); images their intrinsic size; instances their component's viewBox.
  A container may be a child of another (nesting, `layout.containers`).
- **Single line only** (no wrap) — the owner's minimal subset. Rive's layout engine is not ported;
  the algorithm is our own flexbox subset, written from the CSS Flexbox spec's single-line steps.
- **Units:** grid units, like everything else.
- `.ani`: node `{type: "layout", direction, justify, align, gap, padding, width, height, min…,
  max…, reflow, paints…}` and child `layout: {width, height, min…, max…, alignSelf, margin,
  display, reflow}`; registry-driven, both spellings. Diagnostics with tests: `layout-fill-hug`
  (fill inside a hug parent on the same axis), `layout-bounds` (min > max), `layout-value`
  (bad length/weight), `layout-outside` (layout child props outside a container), and so on.

## 4. Where layout runs (the step contract)

Layout runs in `Player.step` **after bindings and clamping, before drawing** (§7 of the spec gains a
"layout" stage). Inputs: the resolved node properties (so bound and animated values apply) and text
measurements. Output: one box per participating node, `{x, y, width, height}` in the container's
space, exposed as `player.layoutBox(id)` and written to the node's drawn geometry (position for all
children, size for containers, fill children and stretch). Machine guards that read layout values
read the previous step's boxes (documented; Rive's update pass needs a feedback pass for the same
reason — `docs/research/rive-animation-and-state.md`, update pass and feedback loops). Recompute only
when an input changed (dirty flag per container). Deterministic → conformance cases for every row.

**Animated reflow** (`layout-reflow`): when a box changes, the drawn box moves from the previous drawn
box to the new one over the `reflow` duration with its ease (the existing ease vocabulary);
retargeting mid-flight starts from the current drawn box (no snap). Reduced motion: snap.

## 5. Host fit and artboard size (`host-fit`)

`<anima-icon fit="contain" alignment="center">` and `icon.fit` / `icon.alignment`. The SVG renderer
maps fit + alignment onto `viewBox` / `preserveAspectRatio` where they coincide and onto a transform
otherwise; the canvas renderer applies the same transform. `fit="layout"` resizes the document's
root to the host's size (in grid units, `host px / (px per unit)`) and reflows a root `layout` —
the dynamic-size case. `icon.size` reads/sets the document size; `icon.resetSize()` restores the
authored size. The default stays as today (B8: viewBox aspect ratio, `contain`-like).

## 6. Bindable artboards (`data-artboard`)

A model property of type `artboard` holds a component name; an `instance` may bind its component
(`component="$card"`), and the host may assign `p.data.artboard('card').set(name)` or a component from
another loaded document (`icon.component(otherDoc, name)` returning an assignable value). Assigning
re-instantiates the instance with the property's model data (`data.host-artboard`); the instance's
own data context follows the existing components rules. Diagnostics: unknown component, type mismatch.

## 7. Text carry-overs (18 rows)

After the `text` split (P7-1), one closure ticket (P7-6) takes the carried rows
(`docs/parity/P6-closure.md`): native geometry correspondence for fit-baseline, fit-layout-measure,
overflow-ellipsis, fit-font-size, vertical-trim (fix or intentional difference with reasons in the
spec, never a widened budget); native mutation comparisons for run lists and text-style setters;
`text.flatten` through components; font metrics/decoding introspection; arbitrary canvas axes
(feature-detected; evidenced skip where the platform lacks it); the text-input geometry rows; and
`a11y.tree-bounds` painted stroke extents. `text.fit-layout-measure` also becomes layout-relevant.

## 8. Order of work

Wave 1 (parallel, disjoint files): **P7-1** text split (owns `modules/text/**`; exports the
measurement hook layout needs); **P7-2** layout core (owns new `modules/layout/**`: §3, §4 without
reflow, `data.bind-layout`); **P7-3** host fit (owns new `modules/host-fit/**`; `fit="layout"`
against the P7-2 contract via a seam, finished after P7-2 merges); **P7-5** bindable artboards (owns
new `modules/data-artboard/**`, seams in components). Wave 2: **P7-4** animated reflow (owns
`layout-reflow`), **P7-6** text carry-overs. Wave 3: benchmark (§9), parity closure, PR.

## 9. Benchmarks

1. **New P7 brief, "reflow card":** a card whose title and a button label come from data; the button's
   background hugs its label plus padding and **animates** when the label changes length (no snap);
   a row of three chips distributes space (one fills, two hug) and keeps alignment; a hidden chip
   leaves no gap; the card fits the host at two host sizes (`contain` and the dynamic-size mode);
   proof by sampling boxes and data, plus frames.
2. Regression check: rerun the P6 search card in AniML only if layout touches its modules (it adds
   none), otherwise record "no change".

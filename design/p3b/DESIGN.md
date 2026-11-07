# P3b design: accessibility on the browser, headless agent tools, host/data leftovers

Decided by the orchestrator (2026-11-07) for the 124 P3b parity rows, under the owner's triage of
2026-11-07: Anima is a smaller, agent-native Rive for animated web UI; where the browser already does
something well, Anima binds to it. Coders implement this design; a needed deviation is raised with its
reason before it is built. Everything from 0.1–P5b keeps working.

## 0. Scope moves

| Rows | To | Why |
|---|---|---|
| `a11y.role-text-field`, `a11y.state-multiline`, `a11y.state-obscured`, `a11y.text-proxy`, `a11y.inferred-text` | P6 | they describe text and text input, which render from P6; P6's DOM-backed input field is the real element they map to |

The other 119 rows stay. A coder who finds a row already met by earlier work closes it with evidence
(test path) instead of rebuilding it.

## 1. Targets and guards

| Metric | Command | Baseline (main b97a2d5) | Target / guard |
|---|---|---:|---|
| full-featured page | `node tools/size.ts` | 111 723 B | ≤ 116 000 B after P3b (the a11y estimate is 3–4 KB); ceiling 131 072 B |
| core+web | `node tools/size.ts` | 20 362 B | ≤ 20 800 B (only `stop()` and hooks land in web core) |
| `data` / `bind` / `components` | `node tools/size.ts` | 8 034 / 2 038 / 4 051 B | must not grow: new runtime work goes into new modules |
| frame and compile cost | `node tools/perf.ts` | bell frame 32.5 µs, toolbar 22.0 µs, bell compile 1.74 ms (P5b minimums) | within noise (≤ 3 %) on pages that do not load `a11y` |
| oracle | `node tools/oracle.ts --strict` | exit 0 | exit 0; findings recorded, never adjusted |
| benchmark | §9 | P5b: AniML 6/6, Rive 5/6 | AniML ≥ Rive; a regression is fixed before the PR merges |

Agents run these commands but never change them, their inputs or their thresholds.

## 2. Modules and budgets

| Module | Holds | Budget (min+gzip) |
|---|---|---:|
| `a11y` (new; core + markup + web) | node semantics, the semantic tree, diffs and actions (core); the DOM overlay (web) | core 2 048 B, web 2 048 B |
| `devtools` (new; web only) | fps counter, performance marks, deprecation-warning policy | 1 024 B |
| `data-host` (new; split from `data`/`host-edit` as needed) | P3b data and host leftovers (§6) | 2 048 B |
| CLI (`packages/cli`, `packages/core/src/script.ts`) | agent tools (§5) | no limit (tools) |

`a11y` requires nothing; it cooperates with `focus` when both are loaded (§3.4). `data` is at
8 034 / 8 192 B: nothing is added to it; moving code *out* of it to make room is allowed.

## 3. Accessibility (`a11y`)

### 3.1 Authoring

Any node may carry `a11y` (AniML child `<a11y …/>`), with the same registry-driven spellings as every
other module object:

| Field | Values |
|---|---|
| `role` | `button`, `checkbox`, `switch`, `radio`, `radio-group`, `slider`, `tab`, `tab-list`, `link`, `list`, `list-item`, `group`, `dialog`, `alert-dialog`, `heading`, `text`, `img`, `none` |
| `label`, `hint`, `value` | string; `$path` binds to data (needs `data`), an input name binds to an input |
| `level` | heading level 1–6 (`heading` only) |
| `href` | `link` only |
| `checked` | bool input / `$path`; `checked-mixed` (bool) makes it tri-state (`checkbox` only) |
| `pressed`, `selected`, `expanded`, `disabled`, `hidden`, `required`, `readonly`, `modal` | bool input / `$path`, or a literal bool |
| `live` | `off` (default), `polite`, `assertive` |
| `activate` | trigger or bool input (fire / toggle), as the root `a11y` |
| `min`, `max`, `step` | `slider`: numbers, defaults 0, 100, 1; `value` must then be a number input or `$path` |
| `bounds` | local `[x, y, w, h]`; omitted means the node's painted bounds |

The root `doc.a11y` (spec §10) is unchanged and remains the icon's own semantics. Rive names
(`radioButton`, `tabList`, `alertDialog`, `listItem`) are accepted by nothing: Anima uses the ARIA-like
kebab-case above. Traits (checkable, toggleable, selectable, …) are not authored: they follow from
the role and the states present (`trait-*` rows are met by that rule, documented in the spec).

Diagnostics (with tests): `unknown-input`, `input-type`, `bad-value` (level outside 1–6, `href` off
`link`, `min ≥ max`, `checked-mixed` off `checkbox`), `a11y-role-state` (a state the role cannot have,
hint lists the states it can), `undeclared-feature`.

### 3.2 The semantic tree (core, normative)

`player.semantics()` returns the tree, rebuilt after each step only when an input it reads changed:

```ts
type SemanticNode = {
  id: string;                 // node id; dotted path inside component instances
  role: string;
  label?: string; hint?: string; value?: string | number; level?: number; href?: string;
  states: { checked?: boolean | 'mixed'; pressed?: boolean; selected?: boolean; expanded?: boolean;
            disabled?: boolean; required?: boolean; readonly?: boolean; modal?: boolean;
            focused?: boolean; live?: 'polite' | 'assertive' };
  min?: number; max?: number; step?: number;
  bounds: [number, number, number, number];   // world grid units, transformed by current matrices
  actions: ('tap' | 'increase' | 'decrease' | 'focus')[];
  children: SemanticNode[];
};
```

- Children are the nearest descendant nodes that have `a11y`; nodes without it are transparent.
  `role: none` is transparent too (its children are lifted). Repeated list rows and component
  instances contribute their own nodes, in authored order.
- A node that is invisible (resolved visibility, as for focus), `hidden`, or under a `modal` sibling's
  scope is omitted with its subtree (`tree-visibility`, `state-hidden`, `state-modal`). Opacity does
  not hide.
- If the focused node becomes hidden, focus moves to the nearest focusable ancestor, else to the next
  focusable node in tree order, else clears (`focus-retarget`); `ancestor-focus` reports `focused` on
  focusable ancestors of the focused node.
- `player.semanticDiff(prev, next)` → `{added: id[], removed: id[], changed: {id, keys}[]}`; the web
  overlay and hosts use it instead of rebuilding.
- `player.semanticAction(id, 'tap' | 'increase' | 'decrease' | 'focus')`: `tap` runs `activate`
  (or toggles `checked`/`pressed`/`selected` when it names a bool and no `activate` is set);
  `increase`/`decrease` write `value ± step`, clamped to `[min, max]`; `focus` calls the focus module's
  `focusTarget` when loaded. Returns whether anything changed. Unknown ids or actions not in the
  node's `actions` return false.

### 3.3 Headless (CLI and scripts)

Script commands (spec §11.2, in `modules/a11y/core/commands.ts`, hooked into `script.ts` by one
dispatch line): `semantics [id]` prints the tree (or a subtree) as one JSON line;
`semantic <id> tap|increase|decrease|focus` performs the action then `step(0)`.
`anima sample --semantics` appends the tree to every snapshot. Rive oracles compare the logical tree
(roles, labels, states, actions) where `~/.rive/bin/rive` can dump semantics headlessly; otherwise the
row gets a skip note with the reason.

### 3.4 Web overlay (bind to the browser)

The web entry `@anima-format/web/a11y` renders the tree as **real elements** in the shadow root,
absolutely positioned over each node's bounds, transparent, not painted:

| Role | Element |
|---|---|
| `button`, `switch` | `<button>` (`role="switch"`, `aria-checked` for switch; `aria-pressed` when `pressed`) |
| `checkbox` | `<input type="checkbox">` (`indeterminate` for mixed) |
| `radio` in a `radio-group` | `<input type="radio" name=…>` in a `role="radiogroup"` element |
| `slider` | `<input type="range" min max step>`, `aria-valuetext` from `value` when it is a string |
| `link` | `<a href>` |
| `heading` | `<h1>`…`<h6>` by level |
| `tab`, `tab-list`, `list`, `list-item`, `group`, `dialog`, `alert-dialog`, `text`, `img` | `<div role=…>` |

- Native elements bring their keyboard behaviour (Space on checkboxes, arrows in radio groups, range
  arrows, Enter on links and buttons); their `input`/`click` events call `semanticAction`, never a
  second implementation. Only `tab-list` adds arrow-key roving (Home/End, arrows), reusing the focus
  module's roving policy when loaded.
- Hidden → element removed; `disabled` → native `disabled` or `aria-disabled`; `live` →
  `aria-live`; `expanded`, `selected`, `required`, `readonly`, `modal` → their ARIA attributes;
  `hint` → `aria-description`.
- Updates apply `semanticDiff` only. When `focus` is also loaded, the focus proxy of a node *is* its
  semantic element (one element per node); DOM focus and logical focus stay in sync both ways
  (`focus-sync`). A page without `a11y` keeps today's behaviour exactly.
- `icon.semantics` (read-only tree) and `icon.semanticAction(id, action)` on the element; an
  `a11y="off"` attribute disables the overlay for hosts that supply their own (`overlay-policy`).

## 4. Reduced motion mid-loop (decided)

Switching reduced motion **on** stops in-progress motion at the next step: each active play state is
re-resolved under its timeline's `reducedMotion` policy as if it had just been entered — `end` freezes
at local time `d` and reports the events in (current local time, `d`] once (the rest of the current
cycle for loops); `skip` freezes at 0 and reports none; `play` keeps playing. Crossfades in progress
complete at once. Switching it **off** resumes frozen loops from their frozen local time; a frozen
`once` stays finished. Why: WCAG 2.2.2 expects moving content to stop when the user asks, and
reduced-motion users who switch the setting mid-animation should not wait for a state change.
Spec §10, conformance cases (on mid-loop, on mid-once, off again), web test with an emulated
`prefers-reduced-motion` change. No Rive counterpart: oracle skip note.

## 5. Agent tools (CLI; no size limit)

Script language (`packages/core/src/script.ts`; also usable in `anima sample`):
- `touch down|move|up <id> <x> <y>` multi-pointer; `pointer drag <x0> <y0> <x1> <y1> [in <n>]`;
  existing `scroll`, `gamepads`, `key` verified and documented as the wheel/gamepad/key rows.
- `data set <$path> <value>`, `data dump [prefix…]` (one JSON line, filtered by path prefixes),
  `data watch <$path…>` (every later snapshot carries the changes since the last one: the stream),
  `data break <$path> [== value]` (the session stops before the step that writes it, reporting the
  writer).
- `expect <address|$path|input> ==|!=|<|>|~ <value>` assertions: a failure prints a diagnostic line
  and makes `anima sample` exit 1; the run continues to collect all failures.
- `seed <n>`: deterministic random source for every runtime feature that draws random numbers
  (default seed 0, so runs are reproducible without it).
- Snapshots: `snapshot --all` reports unanimated values too (P5b follow-up), and `--semantics`.

Commands (`packages/cli`):
- `anima session <file>`: a persistent process reading script lines (or `{"cmd": …}` JSON) on stdin,
  answering one JSON line each; `reload` re-reads the file keeping data; `quit`.
- `anima bench <file> [-s script] [--frames N]`: per-frame step and draw cost (median, p95) and
  compile time, JSON with `--format=json`.
- `anima render` gains `--component <name>` (artboard choice), `--fit contain|cover|fill|none`,
  `--viewport WxH`, `--scale k` (downscale), `--probe x,y[;x,y…]` (pixel colours as JSON),
  `--audio out.wav` (offline mix of the script's audio events through headless Chromium's
  `OfflineAudioContext`; `build-encoder-unavailable` without a browser), and `--preset <name>`.
- `anima compare a.png b.png [--tolerance] [-o diff.png]` (image comparison independent of a glyph).
- `anima schema --search <words>` ranks registry fields, types and diagnostics by name and
  description; `anima schema <type>.<field>` looks one field up.
- `anima inspect --summary`: wiring diagnostics (unbound inputs, unused models, listeners with no
  target, unreachable states) as one table.
- `anima doctor`: Node version, Chromium/Firefox availability, writable cache, module wiring.
- `anima.json` project file: `entry`, `sources` (multi-file project: several `.animl` files
  merged by the existing library mechanism), `presets` (render presets), `out`; every command picks it
  up from the working directory. `anima new --sample <name>` copies a runnable sample project.
  `anima build --out-dir` is the local export (`publish-local`): `.ani`, assets and an HTML page.

## 6. Data and host leftovers (`data-host`)

- Host access: `color(path)` handles on nested paths (`data.host-color`, `host-api.data-color`);
  typed nested paths `data.at("team.lead.name")` (`host-nested-paths`, `nested-models`);
  `component` properties set from the host by name (`data.host-artboard`, `host-api.data-artboard`,
  `bindable-artboards`, `components.host-artboard-reference`); `exportedInstances()`
  (`data.instance-export`); `icon.data.batch(fn)` applies every write in `fn` with one notification
  after the step (`batched-binding`).
- Listener writes: `write="$x"` actions storing `pointer-x`, `pointer-y`, `pointer-delta-x`,
  `pointer-delta-y` (grid units) and `key-pressed` (key name) into data (`input.write-*`).
- Guards comparing live data: `$a > $b` between two data paths (`state-machine.condition-data`).
- `player.computed(id)` → world matrix, bounds and resolved opacity of a node, read-only
  (`transforms.computed-transform-values`).
- Image replacement scope: `image(path).set(…)` affects only the instance whose data it addresses
  (`assets.replacement-scope-image`).
- P5b benchmark follow-ups: `asset("name")` in binding expressions; `icon.src` as a property that
  loads like the attribute.
- `icon.stop()` (web core): stops playback and the clock, keeping the current frame
  (`host-api.stop`).
- Libraries (`markup-libraries`): `export="…"` selection, models declared in a library imported with
  it, `anima library update` checked against the P5b implementation (rows may already be met).

## 7. Order of work

Wave 1 (parallel, disjoint files; at most 5 agents):
1. `a11y` core + markup + spec + conformance + headless commands (§3.1–3.3); may edit `modules/focus`
   core for the focus rows.
2. Script language and `anima session` / `anima bench` (§5, first and second lists up to `bench`).
3. CLI commands (§5 rest: render options, compare, schema search, inspect summary, doctor,
   project file, samples, local export).
4. Data and host leftovers (§6 except `stop` and libraries), the `data-host` module.
5. Reduced motion mid-loop (§4), `icon.stop()`, the `devtools` module, libraries (§6 last item).

Wave 2: 6. the web overlay (§3.4) on wave 1's tree; 7. the benchmark (§9) with fresh agents;
8. parity closure.

Shared files: `script.ts` belongs to agent 2 (agent 1 adds one dispatch line); `cli.ts` dispatch and
usage lines are shared by agents 2 and 3 (keep edits to those lines); generated files are regenerated,
never hand-merged.

## 8. Definition of done per capability

As in PLAN: spec section, registry entries (both spellings), diagnostics with tests, conformance case
(anything that changes `Player.step` output), AniML example and `.ani`, CLI support, size check, Rive
oracle case or a skip note with the reason.

## 9. Benchmark brief (P3b)

An accessible settings card: a tab list with two tabs (General, Sound); on Sound, a volume slider
bound to a number 0–100 in steps of 5 whose spoken value reads "Volume 40 %"; a mute switch; a
"Notifications" checkbox whose state is mixed when some of its three child checkboxes are checked;
labels bound to data. The agent proves it with the accessibility-tree capture and synthetic keyboard
input (arrow keys between tabs, slider steps), not by looking at pixels.

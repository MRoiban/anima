# Agent-native benchmark

The standing measure of the owner's goal (2026-11-06): Anima should be a smaller Rive, and above
all an agent-native one. After every phase, fresh agents get the same brief, built with that
phase's features, in two formats:

- **Anima**: AniML and the `anima` CLI, learning only from `anima docs` / `anima schema`.
- **Rive**: Rive's markup and the Rive CLI's local tooling only (`docs`, `schema`, `create`,
  `inspect`, headless `--commands` capture). Never `--publish`, `--rev`, `push`, `pull`, `login`
  or other account commands; never read `.riv` files; delete scaffold files carrying Rive's
  documentation text before committing.

Same model and effort for both, one fresh agent per run, a fixed timebox. The orchestrator
re-checks every claimed result against the brief (Anima by `anima sample` / `render` scripts, Rive
by its captures) before recording it.

**Recorded per run:** brief items met (strict), attempts and check / render iterations, wall time,
source size, and every diagnostic or friction point. Raw runs live in `runs/<date>-<phase>/` (the
brief, each agent's sources, report and evidence).

**Gate:** a regression against the previous run of the same format — fewer items met, or a new
friction point that blocks an item — is a bug, fixed before the phase's PR merges.

## Results

| Date | Phase | Brief | Format | Items met | Checks | Wall time | Source | Notes |
|---|---|---|---|---:|---:|---:|---:|---|
| 2026-11-05 | P1 | [dark-mode switch](runs/2026-11-05-p1/BRIEF.md) | AniML | 7/7 | 16 | 3 min 28 s | 51 lines | 0 diagnostics; no keyboard toggle for a bool (fixed in M5) |
| 2026-11-05 | P1 | dark-mode switch | `.ani` (JSON) | 7/7 | 11 | 2 min 51 s | 81 lines | 0 diagnostics |
| 2026-11-05 | P1 | dark-mode switch | Rive markup | 4/7 | 25 | 7 min 59 s | 144 lines | mid-slide reversal jumps; reduced motion and pressed state partial |
| 2026-11-06 | P4a | [download button](runs/2026-11-06-p4a/BRIEF.md) | AniML | 5/6 | 35 | 5 min 13 s | 101 lines | item 1 missed: a number input cannot drive a value continuously (progress in quarter steps); 12 document errors fixed on the way; friction: pose rejects path strings, group clips rejected, clip `rule` required, no `anima schema pose`, round caps hide tiny dashes |
| 2026-11-06 | P4a | download button | Rive markup | 5/6 | 30 | 7 min 14 s | 182 lines | item 5 partial: reduced motion only through a host-set input, not during an active morph |
| 2026-11-07 | P5 | [toolbar](runs/2026-11-07-p5/BRIEF.md) | AniML | 6/6 (agent: 5/6) | 14 | 3 min 43 s | 495 lines (28.7 k chars, incl. generator) | one press template + one badge component, bound `count`; the agent marked the pop unverified from a contact sheet that never triggered it — the orchestrator's render with the agent's own script shows scale 1.25 at the peak; dots instead of numbers (no text yet); 'count increased' needs a ladder of 10 states (no previous-value / on-change) |
| 2026-11-07 | P5 | toolbar | Rive markup | 6/6 | 36 | 10 min 48 s | 997 lines (73.3 k chars, incl. generator and a self-made digit font) | one button and one badge artboard reused; pop timing source-verified only |
| 2026-11-08 | P4b | [sync button](runs/2026-11-08-p4b/BRIEF.md) | AniML | 4/6 | 19 | 5 min 10 s | 144 lines | stop-at-next-tick and reverse-from-current not expressible declaratively (only as host API); scrubbing took 13 states; no `anima docs motion` — fixed in P4b-3, AniML rerun after it |
| 2026-11-08 | P4b | sync button | Rive markup | 5/6 | 14 | 5 min 19 s | 911 lines (49.7 k chars, incl. generator) | reduced motion only through a host-set input |
| 2026-11-08 | P4b (rerun after P4b-3) | sync button | AniML | 5/6 | 32 | 4 min 46 s | 64 lines | stop-at-tick, reverse-from-current and scrubbing now declarative (`exitNext`, `hold`, `sync`, input `time`); item 5 partial: turning reduced motion on mid-spin keeps the loop ticking (spec §10 applies it to states entered afterwards). The reported 'stop stays pending' was the script's `advance 0`; one step later it completes (orchestrator re-check) |
| 2026-11-10 | P4c | [volume control](runs/2026-11-10-p4c/BRIEF.md) | AniML | 5/6 | 33 | 5 min 49 s | 61 lines | arrows cannot change `volume` by 0.1 (no arithmetic in actions — the P4d-3 fix; rerun after P4d merges); input docs incomplete, `@after(0)` pulse guidance misleading |
| 2026-11-10 | P4c | volume control | Rive markup | 6/6 | 10 | 7 min 8 s | 155 lines | native drag lost the grab offset and self-transitions skipped bookkeeping — both worked around by hand |
| 2026-11-09 | P4d | [share button](runs/2026-11-09-p4d/BRIEF.md) | AniML | 3/6 | 15 | 5 min 53 s | 62 lines | a listener cannot increment an input (`set` takes literals only) → a ladder of states capped at 10, milestones stop after 10; audio requests verified, audible output not — fixed in P4d-3, AniML rerun after it |
| 2026-11-09 | P4d | share button | Rive markup | 5/6 | 9 | 3 min 55 s | 150 lines | event payload fields not visible in the headless log; audible output and new-tab opening unverified |
| 2026-11-09 | P4d (rerun after P4d-3) | share button | AniML | 5/6 | 13 | 3 min 30 s | 33 lines | increments, event fields and milestones verified to click 1 000; audible playback unverified (request verified; neither format can hear headlessly); `inspect` printed compiled code for the increment (fixed) |
| 2026-11-10 | P4c (rerun after P4d merged) | volume control | AniML | 6/6 | 19 | 3 min 17 s | 66 lines | arrow keys now step `volume` with an expression action; 370 sampled comparisons |
| 2026-11-06 | P4e | [scoreboard](runs/2026-11-06-p4e/BRIEF.md) | AniML | 5/6 | 15 | 4 min 22 s | 62 lines (3.8 k chars) | item 3 partial: no read-only computed model property, so the formatted labels live on node custom properties; bind expressions lack comparisons (leader done with 3 states; misleading `bind-syntax` hint); guide recommends a missing `anima schema data` — fixes in P4e-8, AniML rerun after it |
| 2026-11-06 | P4e | scoreboard | Rive markup | 5/6 | 26 | 7 min 6 s | 205 lines (32.9 k chars, incl. generator) | item 3 partial: labels format and update but stay host-writable; fractional formatting approximated |
| 2026-11-06 | P4e (rerun after P4e-8) | scoreboard | AniML | 6/6 | 39 | 5 min 11 s | 44 lines (3.0 k chars) | computed `label` property on the model (read-only, `derive`); leader by comparisons; 126 asserted snapshots. Friction: a sample-script write to a computed property said “takes a string” instead of `read-only-path` — fixed before the PR |
| 2026-11-06 | P5b | [playlist](runs/2026-11-06-p5b/BRIEF.md) | AniML | 5/6 | 38 | 10 min 9 s | 95-line scene (300 lines / 21.1 k chars with media generator and checks) | item 4 partial: clicks request clips, but audio from repeated rows is silent in the browser; `build --embed` skipped component-local assets; `$tracks.length` rejected as a repeat count; inherited data contexts forced asset catalogs in every component (12 `data-asset`); doc contradictions — fixes in P5b-10, AniML rerun after it |
| 2026-11-06 | P5b | playlist | Rive markup | 5/6 (agent: 6/6) | 31 | 7 min 46 s | 386 lines (30.9 k chars, incl. generator) | item 4 approximated: the audio clip lookup never resolved (no diagnostic), so trims were pre-cut into separate WAVs by the generator; host list edits through a command adapter (CLI has no list mutation); colours dithered ±1 |
| 2026-11-06 | P5b (rerun after P5b-10) | playlist | AniML | 6/6 | 34 | 7 min 53 s | 67-line scene (224 lines / 14.1 k chars with media generator and checks) | repeated-row clips start and finish with exact trims in the browser; list edits keep row state; friction: `asset(...)` works in guards but not bindings, `icon.src` as a JS property loads nothing (attribute works), unanimated values absent from `sample` snapshots |
| 2026-11-07 | P3b | [settings card](runs/2026-11-07-p3b/BRIEF.md) | AniML | 4/6 | 27 | ~10 min | 123-line scene (17.3 k chars; 278 lines of generator/verifier) | item 1 not met: no text until P6, so labels are vector glyphs and renaming a tab changes only its accessible name; item 3 not met: no value text separate from the numeric value, so "Volume 40 %" is the label. Friction: `docs a11y` / `docs --list` lack node accessibility, `schema a11y` shows only the root roles, the `semantic` action command is undiscoverable, focused-slider arrow keys do nothing headlessly, `expect` rejects AniML spellings (`volumeFill.width`), `$volume-5` parses as one path, the pre-commit hook fails without local node_modules. Orchestrator re-check: `validate` ok, the tabs evidence reproduces byte for byte |
| 2026-11-07 | P3b | settings card | Rive markup | 5/6 | 15 | ~10.5 min | 924 lines (46.7 k chars, incl. two logic scripts and verifier) | item 3 partial: the semantic tree has no numeric min/max/step (range stated in the hint); spoken value "Volume 40 %" → "45 %" checked. Text runs bound to data with a downloaded open font; focus on click needed explicit listeners. Orchestrator re-check: slider and checkbox captures match the report |
| 2026-11-07 | P3b (rerun after P3b-10a/10b) | settings card | AniML | 5/6 | 16 | ~6 min | 129-line scene (29.9 k chars; 507 lines / 55.7 k chars with generator, verifier and six input scripts) | item 1 not met — owner-accepted gap (no text until P6; accessible names follow the data, drawn labels do not). Items 2–6 met with headless semantic trees and synthetic keys/actions; spoken value via `value-text`. Friction: tab-list arrows rove focus but don't select (needed explicit focus listeners; no recipe in the docs); acting on a hidden control silently does nothing; `docs authoring` too long for one output; `docs spec --list` repeats the topic list; stale "pending" notes in the convert and a11y guides. Orchestrator re-check: `validate` ok; slider spoken values 40→45→50→45→40→100 % reproduce |
| 2026-11-07 | P3c (regression rerun after the size round) | settings card | AniML | 5/6 | 17 | ~6 min | 129-line scene (9.9 k chars; 233 lines / 22.8 k chars of generator, verifier and input scripts) | item 1 not met — owner-accepted gap (no text until P6). Items 2–6 met; no regression from the size cuts or the `markup-hooks` authoring import. Friction: `grid="40 30"` gets `bad-attribute` without a hint to use `viewBox` for a rectangular scene; `schema text` answers with a generic usage message; `docs authoring`/`docs markup` still long for one tool response; the a11y guide still says a bounds row "remains planned" next to implemented text. Rive not rerun (its tooling is unchanged since P3b: 5/6). Orchestrator re-check: `validate` ok; spoken slider values 40→45→40→45 % reproduce |
| 2026-11-08 | P6 (settings rerun) | [settings card](runs/2026-11-08-p6/SETTINGS-BRIEF.md) | AniML | 6/6 | 16 | ~6 min | 116-line scene (7.3 k chars; 342 lines / 14.5 k chars with proof and verifier) | **item 1 met** (owner exit criterion): every drawn label binds data; renaming tabs and labels redraws them. Friction: a run's `text="$path"` shorthand updated names but not the browser-text drawing (explicit binds worked; fixed in P6-9b: text cache invalidation); `--font` undocumented for `sample`; a missing font said `script-usage` (fixed: `font-missing`). Orchestrator re-check: `sample` proof exit 0 (29 snapshots); browser-text render after renames draws the new labels |
| 2026-11-08 | P6 (settings rerun) | settings card | Rive markup | 5/6 | 18 | ~7 min | 1 024 lines (52.3 k chars, incl. generated RML and checks) | item 3 partial (unchanged): no numeric min/max/step in the semantic tree. Labels bound to data with the generated test font. Orchestrator re-check: 77/77 evidence assertions; renamed-label frame |
| 2026-11-08 | P6 | [search card](runs/2026-11-08-p6/SEARCH-BRIEF.md) | AniML | 5/6 | 38 | ~7 min | 46-line scene (3.7 k chars; 188 lines with a JS filter helper) | item 3 approximated: no substring or case folding in expressions, so a host helper filtered; `session --font` lacked the text measurer — fixed in P6-10 (`contains`, `lower`, filter recipe) and P6-9b; AniML rerun after them |
| 2026-11-08 | P6 | search card | Rive markup | 6/6 | 10 | ~6 min | 173 lines (13.0 k chars; 322 with helpers) | field is a scripted key handler (no caret, selection or IME); filtering in Luau. Orchestrator re-check: assertions pass; title frames show the stagger |
| 2026-11-08 | P6 (rerun after P6-9b/P6-10) | search card | AniML | 6/6 | 19 | ~5 min | 109-line scene (6.6 k chars; 228 lines with generator, proof and verifier) | filtering in the scene with `contains(lower($label), lower($query))`; native field (caret, selection, IME via the browser). Friction: text-input docs still show the old equality search; `schema textInput` has no did-you-mean; `schema rect` doesn't list required `x0`/`y0`; a local text-style `fill` binding rejected (`unknown-address`); `grid` pair still needs a viewBox hint. Orchestrator re-check: `sample` proof exit 0, verifier PASS, wave frames |
| 2026-11-08 | P7 | [reflow card](runs/2026-11-08-p7/BRIEF.md) | AniML | 6/6 | 15 | ~8 min | 37-line scene (2.3 k chars; 316 lines with exercise script, host page and checks) | native layout: hugging button, 0.3 s reflow that continues smoothly on retarget, filling and hidden chips, `fit="layout"` at 600 × 300; all in the scene. Friction: `data set` (and browser data access) threw `Cannot redefine property: busy` with reflow + host data loaded — fixed before the PR (busy chaining, regression test); `set $path` worked; the short action example lacks transition action syntax. Orchestrator re-check: `sample` proof exit 0, 19 assertions |
| 2026-11-08 | P7 | reflow card | Rive markup | 6/6 | 16 | ~8 min | 151-line scene + 59-line Luau controller (621 lines / 26.0 k chars with checks) | native layout measures and hugs; native layout interpolation and the interpolator converter restart from an earlier endpoint when interrupted, so a Luau controller animates the width from the current value; text width stayed zero in a narrow button until `hugUnbounded`. Orchestrator re-check: evidence checker PASS |

### P4a findings → actions

- **Continuous input → value binding** (AniML item 1): scheduled in P5, where component inputs need
  the same mechanism (a number input bound to an animatable value, with a linear map).
- **Paint/composite friction** (pose path strings, group clips, optional clip rule, `anima schema
  pose`, dash caps in the docs): fixed in P4a before its PR merges.
- Orchestrator re-check: AniML progress 0.6 samples to `trimEnd` 0.5 (quarter steps confirmed);
  morph, clipped sweep and reduced motion seen in a render sheet; Rive mid-morph and clipped-sweep
  frames inspected.

### P5 findings → actions

- **'Value increased' detection** (AniML): the badge pop needed one state per count (0–9) because a
  transition cannot compare an input with its previous value. Scheduled in P4c (`interaction`):
  an on-change / previous-value condition.
- **Text** (both): AniML has none yet (P6); Rive needed an embedded font.
- **Script semantics** (AniML): a `set` before the first `advance` resolves the initial state with
  the new value, so a sheet rendered with `-e "set unread 4"` never shows the pop; documented in
  `docs/AUTHORING.md` (sampling) as part of P5's wrap-up.
- Orchestrator re-check: AniML pop at 0.125 s renders `matrix(1.25 0 0 1.25 -1 -1)` on both badge
  groups with the agent's `badge.script`; Rive frame 08 shows the shared badge on bell (3) and
  trash (2).

### P4b findings → actions

- **Declarative timeline control** (first AniML run 4/6): `sync`, `exitNext="step|loop"`, `hold`
  and an input-driven timeline `time` added in P4b-3; the rerun met those items (5/6).
- **Reduced motion switched mid-animation**: spec §10 applies the policy to states entered after the
  switch, so a looping timeline keeps playing until its state changes. For accessibility an
  in-progress loop should probably stop at once; that changes 0.1 playback, so it is a spec decision
  scheduled with the `a11y` work (P3b), not patched in P4b.
- Rive again needed a host-set input for reduced motion (no OS preference in the runtime).

### P4c / P4d findings → actions

- **Arithmetic in actions** (P4d share button 3/6, P4c arrows): `set="count=count+1"`, expression
  event fields, `mod`/`floor` in conditions (P4d-3); P4d rerun 5/6, P4c rerun after P4d merges.
- **Interaction docs** (P4c): module contracts inline in `anima docs <module>`, examples per module,
  `write` direction in `anima schema listener`, the `@after(0)` pulse recipe, inspect labels,
  address spelling (P4c-6).
- Both formats: audible audio output cannot be verified headlessly.

### P4e findings → actions

- **Computed read-only model properties** (both formats missed item 3): a property with a value
  expression, per instance, `$` paths relative to its own instance, writes rejected with
  `read-only-path` — new `derive` module (P4e-8); AniML rerun **6/6**.
- **Comparisons in bind expressions**: the same operators as `when` guards, one grammar, and a
  `bind-syntax` hint that names the unsupported token (P4e-8).
- **Docs and CLI agreement**: every `anima schema` / `anima docs` topic the guide names exists, tested
  (P4e-8).

### P5b findings → actions

- **Repeated-row audio** (AniML item 4): the browser audio handler skipped list-owned players — fixed
  in P5b-10 with a two-engine playback test; rerun 6/6.
- **Component-local assets**: `build --embed` now embeds them; components resolve asset names up to
  the root document (no duplicated catalogs); `$list.length` is a valid repeat count; strings have
  `length` (P5b-10).
- **Open (P3b, agent tools)**: `asset(...)` in binding expressions; `icon.src` as a property should load
  like the attribute or say why not; `sample` should report unanimated values; Rive's audio clip
  lookup failed silently for its agent (not ours to fix).

### P3b findings → actions

Gate: AniML 4/6 is below Rive (5/6). Both misses are bugs except the one that needs text:
- **Item 1 (visible labels from data): owner-accepted gap, not a regression** (owner, 2026-11-07).
  It needs text, which is P6; a quick label in P3b would be thrown away or settle text design before
  the P6 design, and add bytes to full modules. The settings card is rerun after P6 (a P6 exit
  criterion), so the P6 benchmark covers text bound to data. The AniML rerun before the P3b PR must
  reach at least 5/6, item 1 being the only miss.
- **Item 3 (spoken value)**: add a slider value text separate from the numeric value (P3b-10), then
  rerun AniML before the PR merges.
- **Discoverability** (P3b-10): `docs a11y` / `docs a11y-dom` topics and `docs --list`; `schema a11y`
  covering node semantics; `semantic <id> tap|increase|decrease|focus` in `--help` and the guide.
- **Headless keys** (P3b-10): keys on a focused semantic node act as the native element would
  (slider arrows step, Space/Enter activate, arrows rove a tab list), so scripts match the browser.
- **Scripts** (P3b-10): `expect` accepts the same AniML spellings as `snapshot`; a hyphen after a
  data path (`$volume-5`) gets a hint to write `$volume - 5`.
- **Hook**: the pre-commit hook skipped neither gracefully nor clearly without `node_modules`; it
  now warns and skips (CI still checks formatting).
- **Rerun (after P3b-10a/10b): AniML 5/6**, item 1 the only miss (owner-accepted). Remaining friction,
  for P3c: a tab-selection-follows-focus recipe (or option) in the a11y guide; a script diagnostic
  when an action targets a hidden or absent semantic node; `docs authoring` paging or a table of
  contents; `docs spec --list` listing spec sections; remove stale "pending" notes from the convert
  and a11y guides.

### P3c findings → actions

- **Regression rerun: AniML 5/6**, unchanged from the P3b rerun; the size round and the
  `markup-hooks` import did not make the format harder to learn.
- For P6 (docs, 0 bytes): a `grid` hint pointing to `viewBox` for rectangular scenes; `schema text`
  naming the P6 text work instead of a generic usage message; shorter default `docs` output (the
  table of contents first); remove the a11y guide's "remains planned" line for bounds or state what
  remains precisely.

### P6 findings → actions

- **Exit criterion met.** Settings card: AniML 6/6 (item 1 met) ≥ Rive 5/6. Search card: AniML
  6/6 after P6-10 (`contains`/`lower` and a filtering recipe) and P6-9b (`session --font`) ≥ Rive
  6/6.
- Fixed before the PR: run `$path` text redraw, `--font` documented for every command that lays
  out text, `font-missing` diagnostic, `session --font`, string functions for filtering.
- Docs/diagnostics (P6-12, 0 runtime bytes): text-input docs drop the equality-search example;
  `schema` did-you-mean for camel-case topics (`textInput` → `text-input`); `schema rect` lists
  required `x0`/`y0`; `grid` pair → `viewBox` hint; the P3c items (shorter default `docs` output,
  a11y guide bounds line). The local text-style `fill` binding goes with P6-11.

### P7 findings → actions

- **Reflow card: AniML 6/6 ≥ Rive 6/6**, with a 37-line scene against Rive's 151 lines plus a
  59-line controller: Anima's reflow continues from the drawn box on retarget (design §4), which is
  what the brief's interruption item asks; Rive needed script for it.
- Fixed before the PR: `busy` redefinition between layout reflow and the host data API (data writes
  threw); regression test in `modules/layout/test/core/layout-animated-reflow.test.ts`.
- Docs (0 bytes): show transition `actions` syntax in the short actions example.

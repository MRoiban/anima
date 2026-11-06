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

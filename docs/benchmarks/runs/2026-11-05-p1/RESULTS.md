# Head-to-head results: the dark-mode switch (2026-11-05)

Three fresh agents (GPT-6.1-Sol, high effort, one run each) got the same [brief](BRIEF.md), each
limited to one format's own docs, CLI and bell example, with a 45-minute timebox. Their sources and
reports are in [`animl/`](animl/), [`ani/`](ani/) and [`rive/`](rive/).

| | AniML (`.animl`) | hand-written `.ani` | Rive markup (RML) |
|---|---:|---:|---:|
| Wall time | 3 min 28 s | 2 min 51 s | 7 min 59 s |
| Check runs (validate / sample / render / capture) | 16 | 11 | 25 |
| Authoring errors reported by the tools | 0 | 0 | 0 (1 inspect warning) |
| Other errors (paths, setup) | 3 (missing `npm ci`) | 3 (setup, schema topics) | 16 (capture paths, stdout dumps) |
| Source | 51 lines, 1 997 chars | 81 lines, 2 427 chars | 144 lines, 13 024 chars |
| Brief items met (strict) | 7/7 | 7/7 after re-check (below) | 4/7 |

## Re-checked by the orchestrator

- **Both Anima files behave identically.** One script drove each through hover, press, release
  (toggle on), a second click mid-slide and a leave; every sampled value matched: knob `x` 4 → 8 at
  0.15 / 0.3 s, track fill opacity 0.5 → 1, scale 1.15 / 0.85 / 1.15 / 1, and the reversal at 0.1 s
  turns around from `x = 6.146` (no jump). Reduced motion lands on the end state at `t = 0`.
  `animl/switch.ani` is byte-identical to a fresh `anima build animl/switch.animl`.
- **Accessibility:** both declare `role switch`, label and `pressed="on"`. A new browser test
  (`exposes switch semantics…`, Chromium and Firefox) loads the AniML build and checks
  `role="switch"`, the label, and `aria-checked` following clicks; the `.ani` file declares the
  same `a11y` object. The `.ani` agent ran no browser and counted 6/7; with that test it is met.
- **Rive item 3 fails as reported:** captures 13 → 14 show the knob jump about 29 px toward "on"
  when the toggle reverses mid-slide (early exit does not carry the current pose). Items 6 (reduced
  motion needs the host to set an input) and 7 (native "toggled" semantics, not a pressed state)
  were counted partial by the agent; that is fair under a literal reading.
- **Audit warnings** from `npm ci` are in dev tooling only: `npm audit --omit=dev` finds 0.

## What it says about AniML

- The brief was easy for both Anima formats: neither agent hit a single authoring diagnostic, and
  both found the same design (two layers with pose states and blended, interruptible transitions;
  a separate fill rect because paint has no alpha). AniML was 37 % fewer lines and 18 % fewer
  characters than the JSON, a little slower in wall time (it also ran a browser check the `.ani`
  agent skipped). One run per format is not enough to rank AniML against `.ani` on speed.
- The large gap is to Rive's markup: 6.5× the characters, generic ids and bindings to wire a
  boolean toggle, and a behaviour (continuous reversal) the agent could not get in time while every
  build and `inspect` reported no problems. Anima's sample loop made the reversal checkable as
  numbers.
- **No markup change is indicated by this run.** The markup design stays as specified.

## Gaps found (format, not markup)

1. **Keyboard toggle for switches.** `a11y.activate` must name a trigger, and a listener cannot
   toggle a bool from the keyboard, so a switch cannot be toggled with Enter/Space. Both agents
   noticed. Fix: let `activate` name a bool (activation toggles it). Spec + loader + web + a
   conformance case → scheduled in P3 (web host API).
2. **Paint alpha.** Fading a fill needs a second shape. Covered by P4 paint (`paint` module).
3. **`anima schema` covers node types and paints only**; `transition` and `a11y` were asked for.
   Small CLI addition → P3.
4. A missing `npm ci` shows up as `ERR_MODULE_NOT_FOUND` with no hint (repo setup, not the CLI).

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

### P4a findings → actions

- **Continuous input → value binding** (AniML item 1): scheduled in P5, where component inputs need
  the same mechanism (a number input bound to an animatable value, with a linear map).
- **Paint/composite friction** (pose path strings, group clips, optional clip rule, `anima schema
  pose`, dash caps in the docs): fixed in P4a before its PR merges.
- Orchestrator re-check: AniML progress 0.6 samples to `trimEnd` 0.5 (quarter steps confirmed);
  morph, clipped sweep and reduced motion seen in a render sheet; Rive mid-morph and clipped-sweep
  frames inspected.

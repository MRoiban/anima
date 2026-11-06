# Input implementation work log

## Now
Goal: P4c-4 integrated input/focus/machine/components.
State: 54 implementation evidence sets; 18 strictly complete, 36 native oracle captures pending.
Next: phase owner runs native oracle pass and phase benchmark/CI; see REPORT.md for checks.
Don't: promote pending oracle rows; reapply the superseded integration.patch; change parity status.

## Log
- 2026-11-06 02:10 [input]: installed tools after missing prettier; scaffolded all 54 rows with dry runs → generated pending evidence, parity status unchanged.
- 2026-11-06 02:20 [input]: implemented player/controller, hit/collapse hooks, host and compiler/command helpers → 41 deterministic unit tests pass; shared names tests need new attribute lists; first browser run 44/46, exact float expectations and Firefox immediate legacy event under investigation.
- 2026-11-06 03:43 [input]: final verification → typecheck, format, lint, module wiring, schema, browser/AniML build checks and arrival-order/parity tests pass; scoped failures confined to shared expected lists/corpus census; temporary patched run green (460 pass, 87 pending).
- 2026-11-06 03:43 [input]: perf final → bell compile 2.70 ms, prefix sweep 805 ms; frames bell 52.5/composite 35.2/toolbar 66.6 µs, toolbar compile 5.23 ms; baseline same-session bell 2.65 ms/1054 ms, frames 50.6/30.2/33.8 µs, toolbar compile 4.21 ms; timings varied under machine load.

- 2026-11-06 04:13 [sol]: merged 0dd104a into interaction branch; replaced 51 conformance TODOs and hand hooks with generic fields; event-kind registry and focus seams integrated → final scope1471/shared2000/browser180 pass; size5978 B; 36 native probes pending (evidence: REPORT.md).

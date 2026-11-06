# Input implementation work log

## Now
Goal: P4c-2 input module, 54 requested rows; commit only.
State: implementation + 55 core/vector and 56 browser tests; 6056/8192 B, base 19012 B (+0).
Evidence: 3/54 strict complete rows; 51 conformance/36 oracle probes pending, 15 host-only oracle skips.
Next: parent applies integration.patch; exact patched scoped run 460 pass/87 pending, real checkout 457 pass/3 failures/87 pending.
Don't: edit shared implementation, push/PR/merge, promote incomplete rows, change limits or read .riv.

## Log
- 2026-11-06 02:10 [input]: installed tools after missing prettier; scaffolded all 54 rows with dry runs → generated pending evidence, parity status unchanged.
- 2026-11-06 02:20 [input]: implemented player/controller, hit/collapse hooks, host and compiler/command helpers → 41 deterministic unit tests pass; shared names tests need new attribute lists; first browser run 44/46, exact float expectations and Firefox immediate legacy event under investigation.
- 2026-11-06 03:43 [input]: final verification → typecheck, format, lint, module wiring, schema, browser/AniML build checks and arrival-order/parity tests pass; scoped failures confined to shared expected lists/corpus census; temporary patched run green (460 pass, 87 pending).
- 2026-11-06 03:43 [input]: perf final → bell compile 2.70 ms, prefix sweep 805 ms; frames bell 52.5/composite 35.2/toolbar 66.6 µs, toolbar compile 5.23 ms; baseline same-session bell 2.65 ms/1054 ms, frames 50.6/30.2/33.8 µs, toolbar compile 4.21 ms; timings varied under machine load.

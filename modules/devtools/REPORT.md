P3c follow-up: [P3c-9 report](../data-host/P3c-9-REPORT.md). Historical promotion claims below do not close the P3c carry-overs.

# P3b-5 implementation

Partial handoff: implementation and owned tests pass; the protected components byte guard and
phase bookkeeping remain for integration. No packages, PRs or external services were published.

## Behaviour

Reduced motion is re-resolved before clocks on the next step. Every current play state follows
end/skip/play; end reports the remaining local event interval once. Fades finish immediately,
including queued end actions. Frozen loops resume their endpoint/start time when reduction is
removed; frozen once states remain finished. Motion, machine and nested source-clock wrappers
forward/rebase the resumed clock. Conformance covers all three policies, once, fade completion,
end actions, off again and a source-clocked component and trimmed work-range endpoints (including an already finished reverse once state, which must not replay events). The source-clock fixture initially lacked
bind and used dotted instance addresses; both mistakes were corrected before the passing runs.

`stop()` uses the paused scheduler path and preserves the current frame. The optional devtools
module wraps the public frame method and adds counters, opt-in performance marks and the warning
policy hook. There are no existing runtime console/deprecation warnings to redirect. Base pages
have no instrumentation or devtools code unless they import the module.

Libraries already shipped models and local update support in P5b. This change adds `export` as an
alias of root `exports` / import `select`; nonempty `export` takes precedence. Existing private
resource rules and diagnostics are retained. No measurement inputs or thresholds were changed.

## Parity bookkeeping

Already done: components.library-export, components.library-models, components.library-update.
Implemented, verified and ready to close: host-api.stop, host-api.fps-counter,
host-api.performance-marks, host-api.deprecation-policy. They remain planned with evidence because
`node tools/parity.ts` rejects done rows whose phase is P3b (not yet in its finished-phase list).
The orchestrator must register/close that phase; this ticket does not modify parity tooling.
Host-only APIs add no document fields, diagnostics or CLI commands; their capability directories
explain why registry/conformance grammar is inapplicable. Oracle skip notes describe the missing
native local counterpart rather than claiming native parity.

## Sizes (minified gzip bytes)

| Item | Baseline | After |
| --- | ---: | ---: |
| core+web | 20362 | 20556 |
| markup-libraries | 1933 | 1936 |
| devtools | absent | 283 / 1024 |
| motion | 6614 | 6651 |
| machine | 6032 | 6051 |
| nested | 4514 | 4542 |
| full-featured | 111723 | 112330 |

Protected data 8034 → 8025; bind 2038 → 2036; components 4051 → 4054. The components source
was not edited; its incremental compressed cost changed with the base bundle. The +3 B violates
the ticket's no-growth guard even though it remains below its unchanged 4096 B budget. No budget
was raised or measurement changed. This remains an integration problem.

Stable baseline size was re-run using copies of the original runtime sources and unchanged tooling.
An earlier size attempt overlapped capability scaffolding and is not used as baseline evidence.

Perf before → after: bell 191.4 → 97.4 µs, toolbar 347.7 → 78.5 µs, composite 182.0 → 63.9 µs;
bell compile 10.85 → 6.77 ms. Shared machine contention varied substantially, so these show no
observed regression but do not establish a controlled ≤3% comparison. Initial measurement failed
before npm ci; archive-based baseline preparation was abandoned and replaced by a small runtime
source copy with each changed runtime restored from 98c17e2.

## Verification

See verification/ for final measurement logs, independent conformance results, owned browser
checks, corpus/CLI tests and final broader checks. Earlier broad runs failed under contention,
and some overlapped fixture corrections; they are not presented as successful verification.
Owned browser tests pass 6/6 (Chromium and Firefox), conformance/library 463 pass / 7 existing TODO,
source-clock unit 1/1, canonical corpus/decompile/motion CLI 2274/2274 (including the source-clock unit). Browser compilation is in
beforeAll, not inside the devtools test, to keep the existing test deadline unchanged.

Full web suite: 80/80 passed before the final work-range edge fix; final owned browser recheck
6/6 passed after it. Final broad changed scope: 4700 pass / 2 fail / 42 TODO, with only the
existing scaffolder tests timing out at 60000 ms and 5000 ms. Full typecheck, ESLint, Prettier,
module wiring, parity views and strict oracle passed. All 4 scaffolder tests then passed in isolation without changing limits; the result is recorded in
verification/scaffolder-isolated.txt. No timeouts or test limits were raised.

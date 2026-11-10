# P8 Rottweiler ledger

Phase P8 (rigging, plus carry-overs), branch `p8-rigging` against `origin/main` (97b509f3). Review
scope: the runtime and tooling source in `design/rottweiler/P8-SCOPE.txt`, with tests, docs, oracle
fixtures, probes and generated wiring excluded. One reviewer per round, on Codex Web (GPT-5.6 Sol
Web, medium; owner's provider rule). The orchestrator verifies each finding, then either fixes it
with the smallest change plus a regression test, or pushes back with the reason.

| id | severity | finding | outcome |
| --- | --- | --- | --- |
| O-1 | major | Found by the full check (`module-order.test.ts`), not the reviewer: P8 modules patched `Player` in an arrival-order-dependent way. Scroll set a sticky flag even when `input()` did not exist yet, so a later `input` install dropped its wrapper and drag/wheel never moved the offsets; rig and skin wrapped `values()` once each (first-arrival key order); scroll re-wrapped `values()` on every re-init. | fixed: scroll wraps `input()` only when present and marks the wrapper itself; rig owns one `values()` wrapper and calls `valueProviders` (cleared per init, registered by skin and scroll in dependency order). Regression: `packages/core/test/module-order.test.ts` (12 arrival orders now identical) |

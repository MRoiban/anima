# P8 Rottweiler ledger

Phase P8 (rigging, plus carry-overs), branch `p8-rigging` against `origin/main` (97b509f3). Review
scope: the runtime and tooling source in `design/rottweiler/P8-SCOPE.txt`, with tests, docs, oracle
fixtures, probes and generated wiring excluded. One reviewer per round, on Codex Web (GPT-5.6 Sol
Web, medium; owner's provider rule). The orchestrator verifies each finding, then either fixes it
with the smallest change plus a regression test, or pushes back with the reason.

| id | severity | finding | outcome |
| --- | --- | --- | --- |

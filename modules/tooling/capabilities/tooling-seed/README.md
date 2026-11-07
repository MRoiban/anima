# Deterministic random seed

Status: implementation complete; parity remains planned until P3b phase closure.

Tooling-only commands add no JSON/AniML authoring fields; runtime registry spellings are not
applicable. Both source formats use the same script/API. Contract: spec/SPEC.md §11.2; guide:
docs/AUTHORING.md “Agent tools”. `example.animl` and its generated `.ani` pair work with `script.txt`.
CLI session/bench use the same interpreter as sample. Invalid commands carry code, script pointer,
message and hint; failures and CLI exit statuses are covered in packages/cli/test/agent-tools.test.ts.

Independent conformance: spec/conformance/tooling-input-data. Native comparisons and reasoned
oracle skips (including protocol limits and the reload retention difference):
modules/tooling/oracle/README.md. Measurements and final verification: modules/tooling/REPORT.md.

Core owns the shared seeded source; existing unseeded sequences are preserved. Exact conformance
and API/script/CLI tests are in spec/conformance/tooling-seed and tooling-leftovers.test.ts.

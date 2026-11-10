# D-C Report

## Status

Implemented D-C on `discovery-c`. Schema/docs view extraction, bounded schema output, richer object shapes, docs topic resolution, generated CLI reference, agent entry points, drift tests, and requested documentation updates are complete within D-C-owned files.

Two command-line integrations remain for the orchestrator/D-A because their parser/dispatch block is explicitly outside D-C ownership: `schema --all` must call the exported `schemaAll()`, and `docs --full` must call the exported `docsFull()`.

## What I built

- Moved schema and docs presentation/resolution code out of `packages/cli/src/cli.ts` into `schema-view.ts` and `docs-view.ts`, leaving only import-line changes above the end of `run()`.
- `anima schema` now prints a bounded topic index. Topic pages show one-level object shapes, nested-topic pointers, explicit wording for registry shapes with no AniML attribute, and `Requires` / `Docs` / `Examples` footers.
- Added `schemaAll()` for the complete human-readable schema dump while preserving JSON Schema output through the existing `--json-schema` route.
- Expanded docs resolution across module names, compact feature spellings, parity row IDs, element/type names, aliases such as `constraint(s)` and `semantic`, and section slugs. Misses are concise, suggest nearby topics, and point once to `anima docs --list`.
- Added `docsFull()` for explicit unbounded long-form docs output. Existing no-topic docs output remains contents-first; explicit authoring keeps the historical contents-first + guide behavior required by existing CLI tests.
- Added `tools/cli-docs.ts`, generated `docs/CLI.md`, and `--check` drift detection in the root `check` script.
- Added root and CLI-package `llms.txt` entry points and documented the discovery commands in `README.md`, `docs/README.md`, and `docs/FOR-AGENTS.md`.
- Updated the WORKLOG owner line to record that the repository is public.
- Added schema/docs view tests and CLI-doc drift coverage.

## Verification

Requested final commands:

- `npm run test:scope -- cli`: ran once. It initially reported 6 failures: 3 docs-resolution regressions introduced by this work and 3 bundle tests because this fresh worktree had no generated `packages/web/dist` files. I fixed the docs precedence/authoring behavior; focused regression suites now pass. After `node tools/build-web.ts`, `packages/cli/test/bundle.test.ts` passes 9/9.
- `npm run typecheck`: passed before the lint step. After subsequent type-only cleanup, focused `npx tsc -p packages/cli` and `npx tsc -p tools` also pass.
- `npm run lint`: ran once and found 7 new-file lint errors. They were fixed; targeted ESLint over all D-C source/test files now passes.
- `npm run format:check`: passed.

Additional focused verification after fixes:

- 7 affected test files, 41 tests: all pass.
- `node tools/cli-docs.ts --check`: passes.
- `git diff --check`: passes.
- Acceptance output is captured in `design/discovery/D-C-transcript.txt`.

## Deviations

- I did not edit D-A-owned parser/dispatch code to wire `schema --all` or `docs --full`. The view-layer entry points are implemented and exported for integration.
- The one requested full CLI scope run was not repeated after fixes, per the instruction to run it once. Its D-C failures were rechecked with focused suites, and the missing-dist bundle failures were separately reproduced as passing after building the web cache.

## Open problems

None inside D-C-owned files.

## Requests

- D-A/orchestrator: import and dispatch `schemaAll()` when `schema --all` is selected.
- D-A/orchestrator: add/dispatch `--full` for docs through `docsFull()`.
- Orchestrator: regenerate `docs/CLI.md` after merging D-A's populated `COMMANDS` table.

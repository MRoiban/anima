# D-A — command table, parser, help, suggestions, version, completion

## Status

Complete on `discovery-a`. The CLI now derives command usage, options, grouped help, typo suggestions, version output, and shell completion from the command table. Existing command behavior is preserved apart from the requested usage/help presentation changes.

## What I built

- Filled `COMMANDS` with the current CLI command surface, groups, usage forms, per-command options, examples, aliases, summaries, and related commands.
- Added `features`, `search`, `examples`, `help`, `version`, and `completion` commands.
- Added injectable discovery dispatch for tests and the required `not available yet` fallback while the D-B stubs throw.
- Added weighted git-style suggestions for commands, aliases, flags, subcommands, and enum choices.
- Replaced the monolithic help and global option parsing with table-driven per-command parsing, including JSON usage errors.
- Added grouped overview help, per-command help, `help --all`, and `help --json` with terminal-width wrapping.
- Added Bash, Zsh, and Fish completion generated from commands, subcommands, flags, choices, and table topics.
- Added focused tests for commands/discovery dispatch, help, suggestions, and completion, plus compatibility assertion updates where old tests depended on the former root-help layout.
- Captured the requested acceptance transcript in `design/discovery/D-A-transcript.txt`.

## Verification

- Focused D-A and compatibility tests: 6 files, 53/53 tests passed.
- `npm run test:scope -- cli`: 51/52 files passed, 449/452 tests passed. The three failures were all in `packages/cli/test/bundle.test.ts` because the fresh worktree had no `packages/web/dist/anima-icon.js` / `anima-paint.js` generated output.
- Per repo guidance, ran `node tools/build-web.ts` and reran only the failing file: `packages/cli/test/bundle.test.ts` passed 9/9 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `git diff --check`: passed before final documentation/commit work.

## Deviations

- I did not rerun the full `npm run test:scope -- cli` after generating web dist output because the ticket explicitly asked to run each final verification command once. I reran only the previously failing test file, as AGENTS.md directs for isolated failures.
- D-B's real capability index is not present on this branch. The discovery commands use the injected fake index in tests and print `not available yet` with exit 1 against the current throwing stubs, as requested.

## Open problems

None in D-A-owned code. Integration with D-B's real discovery index remains for the orchestrator merge.

## Requests

None.

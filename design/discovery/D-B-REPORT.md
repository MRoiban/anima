# D-B — Capability discovery index

## Status
Implemented the D-B runtime discovery index, ranked search, feature lookup, example lookup, source-derived docs/capabilities/commands/vocabularies, and focused discovery tests on `discovery-b`.

The implementation is functional and fully typed/linted/formatted, but the timeboxed discovery metric did not reach every target. No quiz-specific entries or copied quiz aliases were added.

## Metric

| Metric | Baseline | After |
| --- | ---: | ---: |
| quiz | 13/56 | 35/56 |
| rows reachable | 0/886 | 877/886 |
| rows with docs | 0/886 | 886/886 |
| rows with example | 0/886 | 755/886 |

The 755 example-covered rows are backed by examples discovered from the requested repository paths; no examples were invented.

## Remaining misses and why
Quiz misses are mostly natural-language concepts where the current generic token weighting still ranks adjacent capability/index terms above the expected concrete feature/value in the first five results. Examples include hover/mouse-over, text/font, mesh/path/stroke/star, Lottie/embed, reduced motion/audio, and command-oriented queries.

Nine parity rows remain outside the first five hits when searched by capability text: `animation.seek`, `host-api.auto-bind`, `host-api.cleanup`, `host-api.data-list`, `input.data-listener`, `text.input-limits`, `text.input-placeholder`, `tooling.pixel-compare`, and `tooling.publish-local`.

Rows without examples are genuine gaps in the discovered example corpus or cannot be attributed safely from feature/element use alone.

## Verification
- `npm run typecheck`: pass after fixing two D-B type errors found on the first verification attempt.
- `npm run lint`: pass after local cleanup.
- `npm run format:check`: pass.
- `npm run test:scope -- cli`: 429/435 passed initially. Three asset pipeline tests timed out at Vitest's 5 s default under load; three bundle tests failed because `packages/web/dist` had not been built in the fresh worktree. Per repo rules, after `node tools/build-web.ts`, isolated rerun of `modules/assets/test/cli/pipeline.test.ts` and `packages/cli/test/bundle.test.ts` passed 28/28.
- `packages/cli/test/discover.test.ts`: 4/4 pass, including every indexed doc topic resolving through the real `anima docs` command.

## Deviations
The current checkout has no D-A `suggest.ts`, so D-B uses a local single-word Levenshtein helper as permitted by the ticket.

CLI command entries are derived at call time from the existing `HELP` source in `packages/cli/src/cli.ts` because `COMMANDS` is still empty on the branch base. This avoids a copied command list and can be replaced by D-A's command table once landed.

## Open problems
Search ranking needs another generic tuning pass to hit 56/56 without overmatching noise. Provider-feature inference for some schema entries is conservative because the live registry does not directly expose a provider on every shape/element. Expression functions registered indirectly outside `expression.ts` may need a more complete source scan.

## Requests
D-A integration should expose the populated `COMMANDS` table and typo suggester on the shared branch so D-B can replace its HELP parsing and local typo helper. No API type changes are requested.

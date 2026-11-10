# D-B — Capability discovery index

## Status
Round 2 is complete on `discovery-b` after merging D-A and D-C from `origin/cli-discovery`. The discovery index is built from live module/schema/docs/example/parity/command sources, cached per process, and the real `anima features|search|examples` commands use it through D-A.

The round-2 work fixes capability-specific docs, schema/object-field coverage, feature summaries and `after` metadata, example summaries and attribution, search ranking and typo behavior, command indexing from `COMMANDS`, shared D-A suggestions, and index/search performance.

## Metric

| Metric | Round-2 baseline after D-C | After |
| --- | ---: | ---: |
| quiz | 32/56 | 56/56 |
| rows reachable | 877/886 | 886/886 |
| rows with docs | 574/886 | 886/886 |
| rows with example | 755/886 | 779/886 |

The final `node tools/discovery.ts --misses` run reports 107 rows without an attributable example. A filesystem check found 0 matching capability example files among those 107 rows, so there are no known existing capability examples left unattributed. No examples were invented.

## Performance
The user-observed round-2 baseline was about 1.7 s of index-build overhead per command. Intermediate profiling on this branch measured 2.95 s and then 2.17 s while capability docs were still resolved by repeated full-text scans.

Final cold timing on the committed implementation: 304.7 ms for `index()` after module import, 7,629 entries. This is below the 0.4 s budget. Capability docs now use D-C's directly resolvable row-id topics, source files are cached, capability/example lookups use maps, row attribution is batched, and normalized search data is cached.

## Round-2 fixes
- Capability docs use specific D-C-resolvable topics such as the parity row id; no bare `spec`, `authoring`, or `markup` contents page is used as a capability answer.
- Feature summaries come from real spec/module prose, feature docs use direct module topics, and manifest `after` relationships are preserved. `features ik` includes the `ik` type, element, fields, strength address, `Docs: anima docs ik`, and `After: rig`.
- Schema indexing now walks node/document object shapes for fields and structural topics, includes markup/.ani spellings, animatable addresses, and element-backed object types.
- Vocabulary entries cover supported eases, built-in/registered expression functions, listener events, and core/module script commands with provider features where known.
- Commands derive from D-A's `COMMANDS` table, including aliases, group, option names/short names, and option choices.
- Search uses D-A's `suggest.ts`, limits fuzzy matching to longer unmatched words, gives exact entity/vocabulary matches precedence over capability/doc/example noise, handles concept synonyms generically, and caches normalized search metadata.
- Capability/example summaries are source-derived; capability `example.animl` files use the inventory capability/what text.
- Real-source discovery tests use an explicit 30 s timeout and cover IK completeness, ranking regressions, summaries, uniqueness, examples, and every doc entry resolving through `anima docs`.

## Remaining misses
There are no quiz, reachability, or docs misses. The 107 example misses are rows for which the current example corpus has no directly matching capability example and no safe feature/construct-derived example. They are listed by the final `--misses` output; representative groups include core animation primitives, low-level paint/stroke variants, host API lifecycle controls, state-machine primitives, tooling-only operations, and basic transform properties.

## Deviations
None from the round-2 ownership/API constraints. `packages/cli/src/cli.ts`, `commands.ts`, `suggest.ts`, `help.ts`, schema/docs views, docs content, and `tools/discovery*` were not edited. No API type changes were needed.

## Open problems
Example coverage is limited by the actual repository corpus: 107 done parity rows have no attributable example. Adding examples belongs to the owning capability/module work, not D-B discovery indexing.

## Requests
None.

## Verification
- `npm run test:scope -- cli`: pass, 56 files / 473 tests.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run format:check`: pass.
- `packages/cli/test/discover.test.ts`: pass, 6/6.
- `node tools/discovery.ts --misses`: 56/56 quiz, 886/886 reachable, 886/886 docs, 779/886 examples.
- Final cold `index()` timing: 304.7 ms, within the ≤0.4 s budget.

# D-B - Capability discovery index

## Status
Round 3 is complete on `discovery-b` after merging the current `origin/cli-discovery` base. The discovery index still reaches every done parity row and resolves docs for every row, while search behavior is less quiz-specific and more useful for ordinary interaction queries.

This round fixes malformed quoted-list parsing that created junk entries, removes misleading and phrase-fitted synonyms, gives generic verbs/stop words no ranking power by themselves, adds IDF-style token rarity weighting, and prioritizes concrete vocabulary/schema entries over capability prose. It also fills converter expression vocabulary from the real source and enriches cursor field aliases from the real cursor value list.

## Metric

| Metric | Round-3 baseline | After |
| --- | ---: | ---: |
| quiz | 56/56 | 53/56 |
| rows reachable | 886/886 | 886/886 |
| rows with docs | 886/886 | 886/886 |
| rows with example | 779/886 | 779/886 |

The quiz drop is intentional. The remaining three public misses are:

- `text field the user can type in`
- `if condition in an expression`
- `simulate pointer input headlessly`

I did not restore phrase-specific mappings for those. `text field` and `simulate pointer ... headlessly` were examples of the overfitted phrase mappings round 3 explicitly asked to remove, and the current bind expression source does not expose an `if()` built-in to index honestly.

## Performance
The round-3 baseline was about 0.3 s for a cold `index()` build. Final cold timing on this tree is 263.7 ms for `index()` after module import, with 7,651 entries. This remains below the 0.4 s budget.

## Round-3 fixes
- Replaced the malformed quoted-list regex with a shared `quoted()` parser that requires both opening and closing quotes. This removes bogus event/manifest entries such as punctuation/newline fragments.
- Added an identifier-like-name test for every entry and a regression test that stop-only/unrelated queries return no results.
- Added IDF-style rarity weighting over indexed name/alias/summary tokens so specific content nouns beat common language.
- Expanded stop words with generic verbs such as `change`, `make`, `add`, `use`, `create`, `show`, `do`, `get`, `want`, and `how`.
- Limited fuzzy matching to a single meaningful unmatched token longer than five characters.
- Added kind bonuses that favor event/ease/function/address/field/type/element/feature/command/script/diagnostic answers over capability/doc/example prose when matches are otherwise comparable.
- Added converter math functions from `modules/convert/core/math.ts`, including registered names such as `random`, rather than pointing `random` to parity row ids.
- Added real cursor values as aliases of cursor fields, so `cursor` and cursor-value queries resolve to schema vocabulary.
- Interaction ranking now gives `pointer` pointer events, `wheel` the `scroll` event, `keys` the key events, `cursor` cursor fields, `fade` `in`/`out` plus the opacity address, and `random` the real function.

## Synonym cleanup
Removed or changed mappings that were too specific or misleading:

- `pointer -> sample` removed; `pointer` now maps to real pointer events: `move`, `down`, `up`, `enter`, `leave`, `click`, `cancel`.
- `motion -> reducedMotion` removed because motion is broader than the reduced-motion preference.
- `mesh -> skin` corrected to `mesh -> mesh`; `warp -> skin` removed because mesh and skin are distinct concepts.
- `random -> <row ids>` changed to `random -> random`, which resolves the actual indexed function.
- `headlessly`, `headless`, and `simulate -> sample` removed.
- Phrase-fitted keys `simulate pointer`, `accessibility tree`, `along path`, and `text field` removed.
- Kept only general/common concepts such as `mouse over`, `dark mode`, `reduced motion`, and `follow path`.
- Added natural vocabulary mappings for `wheel`, `keys`, `keyboard`, `arrow keys`, `fade`, and singular `event`.

## Remaining example gap
`rowsWithExample` remains 779/886, so 107 done rows have no attributable example. The final metric lists those rows. As established in round 2, no matching capability example files exist for those rows, so the gap reflects the repository corpus rather than missed attribution. No examples were invented.

## Deviations
None from the ownership/API constraints. Round-3 source changes are limited to `packages/cli/src/discover/**` and `packages/cli/test/discover*.test.ts`, plus this required report. No orchestrator-owned discovery tools or D-A/D-C-owned CLI/schema/docs files were edited.

## Open problems
The three public quiz misses above remain by design rather than reintroducing quiz-shaped synonyms. Private held-out quality cannot be measured directly from this branch, so the implementation targets the failure classes generally through source-derived vocabulary, rarity weighting, stop-word handling, and kind priority.

## Requests
None.

## Verification
- `npm run test:scope -- cli`: pass, 56 files / 476 tests.
- `packages/cli/test/discover.test.ts`: pass, 9/9.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run format:check`: pass.
- `node tools/discovery.ts --misses`: 53/56 quiz, 886/886 reachable, 886/886 docs, 779/886 examples.
- Final cold `index()` timing: 263.7 ms, 7,651 entries, within the <=0.4 s budget.

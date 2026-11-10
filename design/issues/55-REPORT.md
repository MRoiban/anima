# Issue 55 report

- Status: fixed
- Issues covered: #55
- Verify result: pass after the repo-required isolated reruns described below
- Sizes before: nearest committed pre-issue reference is markup 7,433 B and authoring add-on 15,016 B (`modules/mesh/verification/size-final-merged.txt`); the exact `27223f64` baseline was not remeasured during this ticket
- Sizes after: markup 7,701 / 8,192 B; authoring add-on 15,613 / 16,384 B; `node tools/size.ts` exit 0
- Deviations: the requested full scoped test command was run once and exited 1 because a fresh worktree had no `packages/web/dist` plus one asset test hit its 5 s timeout. After `npm run build:web`, the 9 bundle tests passed in isolation; the 19 asset pipeline tests also passed in isolation. The first typecheck found a test-only inference error introduced by this ticket; it was fixed and typecheck then passed.
- Open problems: none known for #55

## #55: decompile drops comments

### Repro

Added a regression case with a `$comment` on a component definition. Before the fix,
`compile(decompile(doc))` returned the same component without `$comment` and no diagnostic.

Proof: `design/issues/proof/55-before.txt`.

### Cause

The base implementation already emitted and compiled first-child comments for ordinary AniML
elements, and `examples/bell.ani` already round-tripped its timeline `$comment`. Components were
special: decompilation recursively produced nested AniML, parsed it, and converted the nested
`<anima>` to `<component>`, but that conversion discarded comment nodes.

There was a second format-wide gap. SPEC allows `$comment` on any JSON object, while objects such
as `inputs`, `colors`, `fill`, `stroke`, action maps, and other containers have no AniML element of
their own. The previous AniML contract explicitly dropped those comments.

### Fix

Canonical decompilation now writes an element object's comment as
`<!-- $comment "JSON string" -->`. The JSON literal preserves leading/trailing whitespace,
`-->`, XML-forbidden code units, and Unicode exactly. Component conversion preserves those comment
nodes.

For descendant JSON objects without an AniML element, decompilation writes
`<!-- $comment /path "JSON string" -->` before the owning element's first child. The path is
relative to that owner's JSON object and each key is percent-encoded. Compilation applies those
scoped comments after the object tree has been built. Existing ordinary first comments still map
to a trimmed `$comment`; free-floating and later comments are still dropped by `build` and kept by
`anima fmt`.

`spec/ANIML.md` documents both forms. A regression test decorates every JSON object in representative
base and component documents and verifies `compile(decompile(doc)).doc` deep-equals the original.
The existing bell corpus round-trip remains covered.

Decision, owner may revisit: reserve the `$comment` comment prefix for exact canonical comments and
scoped comment paths. This keeps normal author comments readable while making every SPEC-legal
`$comment` representable without inventing new elements or attributes.

### Proof and verification

Proof after: `design/issues/proof/55-after.txt`.

Development checks passed for the focused decompile, compile-comment, and Rottweiler tests. Final
verification results:

- `npm run test:scope -- markup conformance cli`: initial run 4 failures, 4,770 passes, 4 todo; the
  three bundle failures were missing `packages/web/dist`, and the fourth was the asset JPEG 5 s
  timeout. After `npm run build:web`, `packages/cli/test/bundle.test.ts` passed 9/9 in isolation and
  `modules/assets/test/cli/pipeline.test.ts` passed 19/19 in isolation.
- `npm run typecheck`: initial test-only TS2339 failure from this ticket; fixed, rerun passed.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `node tools/build-animl.ts --check`: passed, 721 AniML files checked; four pre-existing pending
  cases were reported.
- `node tools/size.ts`: passed, exit 0; markup 7,701 / 8,192 B and authoring add-on
  15,613 / 16,384 B.


# [P3b-10b] Benchmark tooling and repeated converters

Implemented all seven ticket fixes. Runtime change is confined to convert: runners are keyed by
compiled document rather than model identity, so repeated players can clone models without losing
their runner. Player random streams and binding-local caches remain separate. This follows the
model/runtime separation in docs/research/rive-format-and-graph.md.

Tests:

- `packages/cli/test/p3b-benchmark.test.ts`: every on-disk module guide reachable/listed; node/root
  schema and actions; help/agent tools; expect/snapshot aliases, nested addresses and exact inputs;
  subtraction hint and a declared numeric-suffix hyphenated name; missing dependency startup.
- `packages/cli/test/cli.test.ts`: existing complete root a11y registry-field test retained under
  the labelled `root.fields` schema result.
- `spec/conformance/convert-repeat/`: two list rows, arithmetic converter, seeded random converter,
  reseed/replay. Independent expected arithmetic is score × 2 and two uint32 LCG draws from 42:
  0.2523451747838408, 0.08812504541128874. AniML source rebuilt with the prescribed generator.
- `packages/markup/test/corpus.test.ts`: exact census 487 → 488 for the added conformance case.

Verification: CLI + convert scope 3,157 passed / 427 not selected, 44 files (both browser engines).
Required changed scope: 7,991 passed / 43 existing TODOs, 241 passing files / 13 skipped,
573.68 s, exit 0 (two workers, browser-inclusive). Focused benchmark/motion docs tests 11/11; retained CLI/root schema suite 71/71. Typecheck,
changed-file lint/format, module wiring, AniML/web artifact checks pass. Strict oracle exits 0,
retaining findings. The repeat regression is an internal model-clone detail with no faithful
native-format counterpart; existing converter arithmetic/random oracles remain unchanged.

`node tools/perf.ts` exits 0: bell compile 6.02 ms, prefix sweep 1,410 ms, bell/composite/toolbar
frames 77.2/43.1/51.1 µs, toolbar compile 7.27 ms. Shared load average was 11.00; the ≤3% timing
non-regression guard is unverified, not claimed by this run.

Measured gzip bytes (`node tools/size.ts`, all module budgets and gates pass):

| Measurement | Before | After | Ceiling |
| --- | ---: | ---: | ---: |
| convert | 6,779 | 6,782 | 8,192 |
| core + web | 20,622 | 20,622 | 24,576 |
| largest scene (28 scenes) | 51,822 | 51,822 | 65,536 |
| app-UI scene | 91,064 | 91,064 | 131,072 |
| runtime sum | 109,878 | 109,878 | 163,840 |
| authoring add-on | 11,949 | 11,949 | 16,384 |
| Rive-class | 115,390 | 115,390 | 256,000 |

Boundaries/deviations:

- Subtraction guidance is applied by the CLI validation path to diagnostics at the same pointer;
  package-level `load`/`compile` retain their existing diagnostics. This avoids growing protected
  data/bind modules or changing their path grammar. AniML and JSON CLI paths share the helper.
- P3b-10a's value-text/headless key contract is absent from this checkout's design and a11y spec.
  A marked TODO is left in the authoring guide for integration, as the ticket directs.
- The added conformance case requires the shared markup census update outside the owned packages.
- Initial verification caught invalid test fixture syntax, stale root-schema expectations, embedded
  docs heading expectations and the exact corpus census; corrected before final verification.
- Fresh checkout lacked dependencies (`ERR_MODULE_NOT_FOUND` from initial size run); `npm ci`
  restored them. No measurement inputs, oracle findings, budgets or benchmark records changed.

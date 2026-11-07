# BF-3 — downstream runtime B9–B13

Status: **done**. Final changed scope and all required checks pass.
Branch: `t3/web-runtime-lifecycle-bugs`. Base: `1d0b8d80` (`p6`). Branch-only delivery; no PR or push.

## Reproductions and fixes

Every original regression failed against the base runtime before the fix. See
[core reproduction](verification/bf3/repro-core.txt) and
[browser reproduction](verification/bf3/repro-browser.txt). Scenes are independent of the downstream
app; only its three requested notes were read, through `git show 3ee3000:<path>`.

| Bug | Reproduction kept in the repo | Fix and decision |
| --- | --- | --- |
| B9 | `test/web/bf3.test.ts`: 24 hosts, 10 roots, generated 108,286-byte document; object/text/inline/URL, LRU/registration, concurrent markup and resource cases | Successful object loads use a WeakMap; text, async authoring and URL sources use 16-entry LRUs. URL compilation is independent of root, resolver and policy. Separate decoding caches retain those resource contexts. Every host owns a Player; assets attach per player, including repeated children created later. |
| B10 | `test/web/bf3.test.ts`: model loaded as alpha, then `loadModel` into beta and fire beta's `pop`; reset and absent-root diagnostics | Host-edit retains the component compiler's already validated exports through its existing hook and preserves the family across model forks. Root selection occurs at instantiation. Missing roots report `unknown-component`, `/component`, message and an available-components hint. Import host-edit before compiling a reusable model. |
| B11 | `test/web/bf3.test.ts`: controlled browser visibility callback, offscreen host data, immediate DOM/state assertions and explicit pause | A busy host becoming visible commits `step(0)` and draws in the callback before scheduling animation. Explicit pause keeps pending writes until play. |
| B12 | `modules/derive/test/core/settled-guard.test.ts`, browser regression above, `spec/conformance/derive-settled-guard/` | Compute once after queued inputs and before clocks/machine guards. One write settles derived value, guard and pose in the same step. Stateful converters receive dt once. This is a pre-machine snapshot: later transition-action writes affect computed values on the next step, without feedback iteration. |
| B13 | `packages/core/test/feature-hints.test.ts`; browser missing-module/retry regression | Confirmed absent registration of machine/motion: loading their web modules makes the same source succeed. Verbose `unknown-feature` diagnostics name the import, e.g. `import '@anima-format/web/machine' before loading this document`. Production terse diagnostics retain their existing size-optimized contract. |

The visibility and lifecycle choices follow the shared sleeping scheduler and push-update guidance in
[runtime research](../../docs/research/rive-web-runtime.md#lessons-for-anima). The derived snapshot
avoids feedback iteration as discussed in [state research](../../docs/research/rive-animation-and-state.md).
No third-party implementation was copied.

## B9 timing

Chromium, same generated scene and 24 selected hosts. Timings include DOM construction and were
collected on the shared machine; they establish the local reproduction, not a comparative perf gate.

| Measurement | Base | Fixed |
| --- | ---: | ---: |
| First host, ms | 42.7 | 46.5 |
| Remaining 23 hosts, ms | 259.0 | 76.2 |
| Total, ms | 301.7 | 122.7 |
| Average later host, ms | 11.26 (compile + instantiate) | 3.31 (instantiate + DOM) |
| Compile hook calls after first host | 253 | 0 |

The fixed test also asserts shared model identity and independent Player identity. Exact before/after
outputs are retained in verification. No elapsed-time threshold was added.

## Size gates

All values are min+gzip bytes, from unmodified `node tools/size.ts`. No budget was raised.

| Gate | Before | After | Ceiling |
| --- | ---: | ---: | ---: |
| Core + web | 20,635 | 21,077 | 24,576 |
| Largest real scene | 52,153 | 52,621 | 65,536 |
| App UI | 85,244 | 85,708 | 131,072 |
| Runtime sum | 104,366 | 104,868 | 163,840 |
| Authoring add-on | 14,543 | 14,529 | 16,384 |
| Heavy bundle | 109,982 | 110,472 | 256,000 |

| Touched module | Before | After | Budget |
| --- | ---: | ---: | ---: |
| assetio | 658 | 680 | 768 |
| derive | 2,381 | 2,381 | 2,624 |
| host-edit | 3,662 | 3,642 | 4,032 |

## Verification

- `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: exit **0**, 8,175 pass, 1 skip,
  40 existing TODO; 253 passed files, 13 skipped files; Chromium and Firefox; 708.31 seconds.
  The preceding enclosing build-plus-scope session printed the same green totals but returned 143;
  its output remains separate from the verified standalone command.
- Bounded focused core run: 4,340 pass, 20 existing TODO; 169 passed files, 13 skipped files.
- Final URL resolver/policy color assertions: Chromium and Firefox, 2/2 pass.
- `npm run typecheck`, changed-source ESLint: pass.
- `node tools/modules.ts --check`: pass, zero stale files.
- `node tools/build-animl.ts --check`: pass, 546 sources.
- `node tools/build-web.ts`: regenerated all 41 browser entries and the standalone demo.
- `node tools/size.ts`: pass, every individual module and all six gates.
- `node tools/oracle.ts --strict`: exit 0; 266 cases, 475 samples, zero failing gated samples;
  inherited findings remain unchanged.
- `node tools/perf.ts`: exit 0; raw output retained. Shared-machine timing is not a non-regression claim.
- Formatting, staged whitespace, web artifacts and module wiring checks: pass.

## Deviations, failures and boundaries

- Component-only libraries with empty root nodes were previously usable through root preprocessing.
  Whole-document compilation exposed their structural rejection. They are now explicitly accepted
  when `requires` declares components, with a matching generated schema and independent
  `components-empty-library` conformance case. Ordinary empty documents still fail validation.
- Parsed cached documents are immutable inputs: pass a new object after editing one. Module
  registration invalidates compilation caches; failed loads remain retryable.
- A compiled model carries no prior host's resolver or source URL. Configure those on the receiving
  host before loadModel. The existing seam test now supplies its resolver explicitly and verifies
  model sharing, local image replacement and different resolver/policy catalogs.
- Initial unbounded scoped testing hit browser timeouts at high shared load and was stopped.
  Unchanged-limit bounded retries passed the affected host-edit suites. Early fixture round trips
  needed canonical empty instance values; the schema conditional needed explicit array types for
  strict schema validation. Those were corrected. An intermediate module-order comparison
  straddled a schema edit and was superseded by the frozen-source core run.
- An intermediate resolver-count assertion expected three calls to a counting resolver; the second
  custom resolver does not increment that counter. Corrected to two, with independent URL color
  assertions passing in both engines. The failed intermediate output remains in verification.
- A later probe found source compilation split by resolver identity; its one extra compile is recorded.
  The final fix separates source and decode caches. An intermediate changed run was stopped for it;
  its incomplete output is not represented as a passing run.
- The complete changed-scope assertion summary was green, but its enclosing session exited 143.
  The cause is unverified. The unchanged standalone changed-scope retry exits 0 with the same totals.
- Two void-union lint errors were corrected with undefined callback result types; emitted runtime
  behavior was unchanged. No timeout, measurement input, finding, benchmark record or budget changed.
- No edits under sibling-owned text/fonts/CLI-font/bind/components/a11y/paint paths. No downstream
  app edits or builds. No publication, licence file, PR or push.

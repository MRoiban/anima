# P4e-2 integration report

Status: **integration implemented; capability completion partial**. Local branch
`t3/integrate-convert-data-hooks`; no push, PR, merge to another branch, publication or parity
status change. All 1,238 inventory status fields match `99940e9`.

Commits: `f02e0bd` merges the converter foundation with data; `789538f` integrates the hooks and
independent evidence. This report/checkpoint is committed separately.

## Implementation

- Named converters/groups dispatch through the composed data module's `registerConverter` hook;
  definitions are selected per loaded document. Formula math/random registers through the active
  bind module's `registerFunction` and compiles with its parser. No second expression parser or
  events-hook composition remains.
- Live `$` operands, binding options and named/positional/sequential template arguments resolve
  through data. Templates include numeric precision, grouping and bounded padding. Range and
  interpolation reuse the existing easing grammar. System unit converters support reverse direction.
- Interpolation maps live inside `ctx.state`, isolated by stable binding key, direction and group
  occurrence. Existing external converters retain their shared state map. Player-local seeded RNG
  shares a stream across bindings, with separate site/policy caches. Active interpolation and
  always-random keep the player awake; once/on-change and completed interpolation allow sleep.
- Fixed interpolation evaluation for unchanged two-way sources. Data's snapshot preserves computed
  `$` paths, and numeric-looking string defaults retain their type through AniML round trips.
- JSON/AniML declarations, example pair, CLI validation/schema/inspect/docs/sample, diagnostics,
  conformance and separate-bundle browser arrival orders are covered.

## Verification

Every command below exits 0. Logs are under `verification/`.

| Command | Result |
| --- | --- |
| `node tools/size.ts` | All unchanged budgets pass; detailed bytes below. |
| `node tools/perf.ts` | Bell compile 1.97 ms; 9,040 prefixes 622 ms; bell/composite/toolbar frames 38.6/23.9/31.7 µs; toolbar compile 4.45 ms. |
| `node tools/oracle.ts --strict` | 212 completed cases / 406 samples, zero failed completed samples; six converter findings retained separately. |
| `VITEST_MAX_WORKERS=1 npm run test:scope -- convert data bind markup conformance oracle` | 3,031 passed / 49 TODO; 32 passing files and 13 placeholder files; Chromium and Firefox included (10 browser tests). |
| `npm run typecheck` | Pass. |
| `npx prettier --check .` | Pass. |
| `npx eslint .` | Pass. |
| `node tools/modules.ts --check` | Zero stale files. |
| `node tools/build-animl.ts --check` | Pass. |
| `node tools/build-web.ts --check` | 24 entries; pass. |

The 49 scoped TODOs include pre-existing data/oracle placeholders; convert's own four pending
capability rows are listed below. No TODO is counted as a passing capability.

All files of the 159 previously completed oracle case trees are byte-identical to `99940e9`
(`verification/baseline-oracles.json`). The existing operand probe was restored after a naming
collision; the new named-converter proof is isolated at `convert-model-operand`. Completed oracle
manifest entries are unchanged; 53 new entries were appended. No oracle tool, tolerance, threshold,
measurement workload or previously completed reference was edited.

## Bytes versus p4e-data

Minified + gzip, measured with the unchanged size tool. No budget was raised or split required.

| Entry | p4e-data | Integrated | Budget / ceiling |
| --- | ---: | ---: | ---: |
| core + web | 20,021 B | 20,021 B (+0) | 30,720 B |
| data | 8,181 B | 8,046 B (−135) | 8,192 B |
| bind | 2,046 B | 1,901 B (−145) | 2,048 B |
| convert | absent | 6,165 B | 8,192 B |
| markup-convert | absent | 620 B | 2,048 B |
| markup | 7,863 B | 7,882 B (+19) | 8,192 B |
| full-featured page | 81,802 B (81.8 KB) | 86,797 B (86.8 KB; +4,995 B) | 102,400 B |

The default web entry is **byte-for-byte identical** to p4e-data; SHA-256
`a559cf43c47d3947bb6da2d27df9c4c84159c5f62ea87ee53ee43586a0c0d7cc` on both sides
(`verification/default-bundle.json`). No converter implementation or scheduler wrapper enters a
converter-free default page. The generic AniML dispatch slot adds 19 B to the markup entry; strict
zero overhead for that compiler entry remains unmet. Data/bind shrink rather than grow. Their byte
savings use the existing browser `VERBOSE=false` contract for diagnostic prose; CLI/core diagnostics
retain messages/hints, and browser codes/pointers and every limit remain intact.

The shared bind change also reduces machine's measured bundle from 6,027 to 5,895 B without editing
machine. Other module readings are in `verification/size.txt`; host/paint/contour/mix/canvas source
files were not touched.

## Performance limits

`verification/perf.txt` contains the standalone command above. Earlier interleaved readings were
contaminated by concurrent verification; retained logs identify that. A subsequent serial comparison
on CPU 7, after this agent's build/test/size jobs finished, produced:

| Workload | p4e-data runs | Integrated runs |
| --- | --- | --- |
| Bell compile | 2.54 / 6.79 ms | 2.85 / 5.77 ms |
| Prefix sweep | 797 / 1,713 ms | 739 / 1,260 ms |
| Bell frame | 51.0 / 81.6 µs | 47.6 / 91.3 µs |
| Composite frame | 28.8 / 63.6 µs | 28.8 / 54.1 µs |
| Toolbar frame | 29.0 / 73.6 µs | 48.8 / 58.6 µs |
| Toolbar compile | 4.38 / 10.06 ms | 10.73 / 9.39 ms |

External machine load remains uncontrolled. These mixed/noisy figures do **not** establish a
quantitative no-regression claim, especially for compilation/data-only documents; that gate is
**unverified**. The identical default browser binary establishes no execution change for that entry.
Measurement tools and their fixed inputs were not changed.

## Capability disposition

`ROWS.json` lists all 66 foundation capability probes individually. The 13 previously completed
inventory rows mentioned by the foundation handoff are not re-promoted or included in this count.

- 62/66 capability conformance vectors complete; **52 native verified, 4 evidenced RNG skips,
  6 native findings**. Four capability probes remain pending.
- Three additional integration vectors cover live binding options, reverse system units and
  two-way interpolation. The named model-operand vector is additionally isolated from the original
  completed data arithmetic proof.
- 65 new `.ani` conformance files versus p4e-data (297 → 362). Expected values originate in literal
  independent arithmetic/string/temporal tables under `evidence/`, never in Anima snapshots.
- RNG skips: `data.formula-function-random`, `data.formula-random-always`,
  `data.formula-random-once`, `data.formula-random-source-change`. Native schema exposes resampling
  modes but no matching numeric seed. Native samples cannot be exact counterparts of the specified
  uint32 LCG. Independent multi-step sequences, policies, player/binding/site isolation are tested.

Native findings, unchanged exact comparison:

| Probe | Anima | Native observation |
| --- | --- | --- |
| Decimal rounder | 2.35 | 2.3499999 (float32 dump) |
| Degrees → radians | 3.141592653589793 | 3.14159274 |
| Enum → uint | 1 | Number bridge remains 0, changed=false, for happy/index 1; native observation path is limited. |
| Boolean → string | `"true"` | `"1"` |
| Number interpolation | `[0,0,5,5,12.5,20]` | `[0,10,10,10,15,20]` |
| Colour interpolation | black, black, #808080, #808080, #404040, black | black, white, white, white, #7f7f7f, black |

Interpolation observes eager Anima initialization versus lazy native initialization on the first
non-default source change; native channel rounding also differs. Parent decisions remain open;
findings are not passing comparisons or skips and do not disappear behind widened tolerances.

Pending probes retain `todo.json` in both suites:

1. `data.converter-color-formatting`: hex/RGBA formats work; HSL/component marker patterns are
   absent. The decided design does not define the marker grammar. Needs a format decision/native
   marker probe; not claimed complete.
2. `data.converter-number-to-list`: bounded pure index/repeated-item lists work. Retained default
   model-instance creation/identity needs list/creation hooks that data does not expose. Retention
   also conflicts with the decided “only interpolate is stateful” rule; needs a design/seam decision.
3. `data.converter-trigger`: boolean/integer values work. Counter increments cannot currently be
   delivered to a trigger destination: data's binding targets are animatable scalars, while custom
   triggers are non-animatable. Needs a destination/write hook.
4. `data.scripted-converter`: forward/reverse script execution requires the P9 VM/protocol.

## Integration adjustments and failures

No decided design was replaced. Necessary shared wiring calls the generated `convertCompiler` slot
from compile/decompile; the independent reader now reconstructs converter fields and JSON options,
and the exact corpus count increases from 297 to 362. Data adds a backward-compatible optional
binding key; bind accepts an optional function availability predicate so math stays feature-gated.
The original bind-only `sin(n)` rejection and all existing assertions remain. No test, timeout,
budget, tolerance or oracle threshold was relaxed.

Development failures were fixed at their cause: numeric-string/default and JSON-argument round
trips, missing independent-reader support, typed `$` snapshot handling, two-way interpolation
scheduling, external shared-state compatibility, stale generated artifacts and initial byte overages
(bind 2,065/data 8,212). Native fixtures initially used a wrong colour key, unqualified time units,
and a formatting pattern without width; schema/setup corrections yielded the retained raw captures.
The first concurrent scoped run hit five Firefox timeouts; identical limits pass with one worker.
A completed operand oracle path collision was caught and restored byte for byte before the final
run. Native differences above and the performance/markup limits remain open and are reported plainly.

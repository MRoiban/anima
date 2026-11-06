# P5b-5 — data extras

Status: **partial**. Ten assigned rows have runtime implementation and independent conformance;
`data.bind-keyframes` remains unimplemented. No new row is promoted to strict capability completion:
canonical oracle registration and the host-side export counterpart remain pending. All 1,238
inventory status fields are unchanged. Local branch `t3/data-extras`, starting commit `a5fa00a`;
no push, PR, merge, package publication or other-repository change.

## Implementation and row disposition

| Rows | Runtime / conformance | Native evidence / remaining work |
| --- | --- | --- |
| `state-machine.condition-data` | Direct data guards retain existing numeric/live-path comparisons; independent numeric guard vector added. | Existing strict `data-bind-conditions` counterpart remains active; new canonical row probe is pending registration. |
| `state-machine.literal-boolean`, `literal-string`, `literal-enum`, `literal-color`, `literal-asset` | Typed equality/inequality; enum membership, asset kind/id, RGBA equality; quoted conjunctions/escaped quotes/dollar text; diagnostics and both spellings. | Five native typed comparator probes: 14 exact observations (four × three, asset × two), module-owned tests. Canonical manifest integration pending. |
| `state-machine.literal-trigger` | Bare consumable `$trigger`; no integer-constant guard syntax. | Schema identifies uint counter key 689; native `notEqual 0` comparator captures three exact observations matching a bare signal guard. Canonical manifest integration pending. |
| `data.converter-color-formatting` | Registry `pattern` in JSON/AniML; byte RGBA, rounded HSL, lowercase hex; unknown markers diagnosed. | Seven exact native component/HSL strings. Native percent-marker authoring maps to decided Anima brace-marker authoring; hex also independently tested. Canonical manifest integration pending. |
| `data.converter-trigger` | Trigger binding targets (data, legacy, custom); first result baselines, output changes queue one next-step fire; unchanged integers/once do not pulse; reverse modes diagnosed. | Four exact changed/same/changed observations plus two nonzero-initial-baseline observations. Canonical manifest integration pending. |
| `data.instance-export` | JSON `exported` / AniML `export`; legacy markup accepted; `dataState(player).exports()` lists explicit authored exports. Internal private instances stay addressable. | Native schema flag/type/default recorded. Headless bound-data dumps do not enumerate exported authored instances; host-side counterpart observation pending. Existing host/host-edit enumeration untouched. |
| `data.bind-keyframes` | **Pending**. Scaffolder dry/run executed with `--module motion`; TODO markers retained. | Requires player-aware sampling in core load/player/modules. `TrackM.sample(time)` and core state-write closures currently have no player context. Mutating shared track values would violate player isolation. |

Native captures are under `modules/machine/oracle/p5b/`, `modules/convert/oracle/p5b-*`, and
`modules/data/oracle/p5b-export/`. There are **30 exact newly captured observations** across
module-owned native tests (17 guards, seven colour strings, six trigger conversions), with no
numeric tolerance. Exploratory colour syntax capture is retained separately and is not parity
proof. No skips or findings were reclassified; no measurement tool, comparator, threshold,
timeout, budget, existing reference capture or `tests/oracle/cases.json` input was edited.

All eleven capabilities started with scaffolder dry-run followed by the real run. The existing
instance-export scaffold was preserved by that tool. Existing `when`, binding and converter
registry fields are reused; `pattern` and the `exported` markup alias extend their owning registry.
Generated wiring/schema/parity/AniML/browser artifacts were regenerated. Shared markup corpus
census increased from 408 to 418, and its independent reader now recognizes the instance-only
`export` alias; no assertions were weakened.

## Verification

- Required broad scope, including owned Chromium/Firefox suites: **4218 pass, 2 fail, 63 TODO**
  (169 files; 288.39 s), using `VITEST_MAX_WORKERS=1` to avoid contention. Both failures reproduce
  unchanged on starting commit `a5fa00a` in an isolated archive: **23 pass, 2 fail**.
  - `modules/derive/test/core/derive.test.ts`: no-computed-declarations test expects absent
    `modelTypes`, while baseline data storage already creates a WeakMap.
  - `packages/core/test/module-order.test.ts`: helper imports `exported['host-edit']` instead of
    manifest export `hostEdit`; `registerModule(undefined)` throws.
- Initial default-concurrency scope: 4199 pass / 17 fail / 63 TODO. Own formatting/alias/census
  issues were fixed; two unchanged 5000 ms timeouts (contour evidence and WebP oracle) disappear
  in the single-worker run. Limits were never changed.
- After the final guard-literal scan correction: data-only scope **2369 pass, 366 filtered,
  12 TODO** (28 files; 33.65 s). Focused extras/CLI/native checks pass; final native converter
  suite adds the two nonzero-baseline observations.
- `node tools/oracle.ts --strict`: exit 0, **245 cases / 441 passing samples**; **24 findings /
  27 finding samples** retained unchanged. New native evidence is in module-owned test suites;
  new canonical probes keep TODO markers because measurement-input editing was excluded.
- Typecheck, ESLint, Prettier, `modules.ts --check`, `build-animl.ts --check`, and browser artifact
  generation/checks pass. Compiled authoring corpus: **459 AniML files**.
- All inventory statuses match `a5fa00a`; forbidden scaffold-doc/binary artifact scan is empty.

Final command outputs and the baseline failure reproduction are preserved in
[verification/p5b5](verification/p5b5/).

## Bytes and performance

Every unchanged budget passes. Core+web is **20,147 B**, **+38 B** over the assigned 20,109 B
baseline. Bind is **2048/2048 B**, unchanged, with no bind-file edits. Data is **7908/8192 B**;
convert **6569/8192 B**; motion **6064/8192 B**; machine **6041/8192 B**; markup **7910/8192 B**.
The data increase includes typed guard compilation, trigger delivery, export discovery and literal
scan handling. The 38 base bytes are the optional guard seam and quotation-aware conjunction split.
Full-featured total: **102,971 B / 131,072 B**; Rive-class total: **107,932 B / 256,000 B**.

Unchanged `tools/perf.ts` exits 0. Same-CPU standalone baseline → branch measurements:

| Metric | Baseline | Branch |
| --- | ---: | ---: |
| Bell compile | 6.99 ms | 6.89 ms |
| All 9040 Bell prefixes | 1502 ms | 1571 ms |
| Bell frame | 94.6 µs | 112.3 µs |
| Composite frame | 46.6 µs | 70.5 µs |
| Toolbar frame | 50.6 µs | 54.8 µs |
| Toolbar compile | 9.52 ms | 9.23 ms |

Concurrent worktrees substantially affected those separate-process timings. An independent
same-process paired run alternates order over 12 pairs on the same CPU, preserving raw samples:
Bell **112.81 → 111.70 µs**, composite **71.83 → 74.28 µs**, toolbar **79.08 → 76.27 µs**,
Bell compile **7.37 → 7.14 ms**. There is no consistent regression across pairs, and no player
stepping code changed. **A quiet-machine no-regression result remains unverified**, particularly
for prefix compilation; the raw slower readings are retained rather than discounted as a pass.

## Deviations and integration handoff

The decided authoring design is unchanged. Incomplete integration is explicit:

1. Add a generic player-aware key-value sampling seam before implementing motion data keyframes.
   Validate references without rewriting authored documents; sample per player before easing,
   including state blends and independent TimelineInstance playback. Keep both TODO probes.
2. Parent-owned integration must register the new captured cases in the canonical oracle manifest
   (or authorize a module-manifest adapter). This task leaves measurement inputs untouched.
3. Host/host-edit owners can expose or consume `dataState(player).exports()` for their public
   discovery APIs. This implementation supplies that data-owned host discovery surface without
   changing their existing all-instance lists; host-side native equivalence is pending.
4. Resolve the two starting-commit failures and rerun the broad scope; rerun performance quietly
   before claiming the phase gates or any parity promotion.

# P5b-2 host-edit implementation report

Status after P5b-4: queue, globals and document cache seams implemented; four component-value rows remain pending. See P5B-4-REPORT.md for current verification. The remainder records the original P5b-2 delivery. Local branch
`t3/host-data-editing-1` only; no push, PR or merge. The commit SHA is supplied in the handoff.

## Delivered

- New optional core/web host-edit entries, generated exports, dependency ordering, 4096 B budget.
- Existing host API remains independent; tested extension before host and after an already-bound
  API in separately built Chromium/Firefox bundles.
- List add/insert/remove/swap/length/at; projected edits compose in call order, preserve live array
  and item identity, validate types/models/bounds/cycles, batch wakeups and notify after step.
- Default/named instance discovery, RGBA/hex and enum member/index helpers.
- Web URL/Blob replacement of a currently referenced image; async decode, queued commit, stale-load
  guard, per-icon isolation, existing asset-name assignment retained. Decoded asset resource changes
  leave the property's ID unchanged. The Blob is persisted as a data URI.
- Existing nested component player access (data/set/fire), named component root loading and runtime
  readiness after imports. Readiness is typed on the constructor exported by the optional web entry.
- Normative module spec, page-author text, AniML/JSON example, independent host-script conformance,
  CLI validation/inspect/sample tests, fresh native scalar/enum captures and evidenced skips.

## Rows (inventory status fields unchanged)

| Row | Disposition |
| --- | --- |
| data.host-artboard | Pending: component-valued property type and consumer absent. |
| data.host-color | Implemented: rgba/hex and existing validated RGBA set. |
| data.host-default-instance | Implemented: authored default record, usable by bind. |
| data.host-enum | Implemented: detached values, index read/write and validation. |
| data.host-global-instance | Pending: host-owned global record rebind hook absent. |
| data.host-image | Implemented: existing IDs plus web URL/Blob decode/replacement. |
| data.host-list-add-instance | Implemented: add defaults/values or a named/create record. |
| data.host-list-add-instance-at | Implemented: insert, projected bounds, identity retained. |
| data.host-list-remove-instance | Implemented: remove identity accessor or local instance record. |
| data.host-list-remove-instance-at | Implemented: index removal, typed bounds errors. |
| data.host-list-swap | Implemented: swap on live item identities. |
| data.host-nested-paths | Existing host paths plus identity-bearing at().get/typed accessors. |
| host-api.batched-binding | Existing host batching/binding plus tested helper wake coalescing. |
| host-api.data-artboard | Pending: same component-value seam. |
| host-api.data-color | Implemented; 4 exact fresh native color observations. |
| host-api.data-enum | Implemented; 6 exact fresh native enum observations. |
| host-api.data-image | Implemented: URL/Blob/ID, async failures and isolation tested. |
| host-api.data-list | Implemented helpers; host whole-list replacement unchanged. |
| host-api.global-models | Pending: global-name metadata and atomic record attachment needed. |
| host-api.nested-models | Existing host paths, at() and existing nested component player access. |
| host-api.view-model-discovery | Existing host models()/instances(); no duplicate API added. |
| host-api.view-model-instances | Existing host create/bind plus defaultInstance()/instance(). |
| host-api.artboard-selection | Implemented: component attribute set before load/reset, both sources. |
| host-api.bindable-artboards | Pending: player handle exists; model-assignable component values absent. |
| host-api.reuse-loaded-file | Pending: web has no compiled Model load/source-cache hooks. |
| host-api.wasm-preload | Implemented AnimaIcon.ready after module imports; Anima needs no WASM. |
| components.host-artboard-reference | Pending: model component reference and cross-file value consumer absent. |

20 rows implemented or already delivered by host; 7 pending for the exact seams above.

## Deviations / limits

- Runtime registry key `hostedit` while imports/manifests are `host-edit`: core and scaffold reject
  hyphens, and the CLI docs topic filter rejects the hyphenated heading too. No core/tool/CLI edit
  within this task's ownership. All required scaffold commands were
  attempted, then module files were created manually. See INTEGRATION.md.
- Extension mutations precede ordinary host queued writes in a mixed step, rather than sharing one
  chronological write queue. Use separate steps for cross-API ordering until host exports enqueue.
- `setGlobal` and compiled-document cache were not simulated with private state or global patches.
- Host-created items stay in instance discovery after removal (no anonymous factory/disposal hook).
  Nested typed handles remain path-based; call the identity accessor again after a swap. Mixed
  repeat metadata is published through DataState.modelTypes; late pre-existing host APIs still need
  a shared map export for ordinary whole-list replacement of newly allocated mixed items (see handoff);
  actual repeat integration is unverified because lists is not present in this checkout.
- URL/Blob replacement requires an existing loaded asset ID, affects its uses within that icon's
  model, and does not emit a data-value event when the asset ID stays the same.
- Component inheritance currently needs child asset declarations when parent data points at assets.
  The browser fixture declares these explicitly; components-owned behavior was not changed.
- Shared spec/SPEC.md chapter and docs/AUTHORING.md inclusion are handed off in INTEGRATION.md.

## Verification

All final commands below exited 0; evidence is under verification/.

| Check | Result |
| --- | --- |
| `VITEST_MAX_WORKERS=2 npm run test:scope -- host-edit host data web conformance oracle` | 4938 passed, 43 existing TODO, 44 passing / 13 skipped files; 404.93 s. Both engines and all four host-edit separate-bundle/load-order cases included. |
| Module-owned coverage within that scope | 27 tests: 23 core/CLI/conformance/oracle plus four Chromium/Firefox cases. |
| Shared metadata follow-up scope | 2766 passed / 43 TODO, including both engines; initial, inserted and whole-list replacement model identities directly asserted. |
| `node tools/oracle.ts --strict` | 216 cases / 410 samples / zero strict failures; 18 existing findings retained unchanged. |
| Fresh module-owned Rive comparisons | 16 exact core observations (including default-instance metadata), plus root-selection name compared in both engines/load orders and reset. Final declared-image skip refresh: 23/23 unit/CLI/oracle tests pass; restored scalar write accepted, two image writes rejected. |
| `node tools/size.ts` | All budgets pass; numbers below. |
| `node tools/perf.ts` | Exit 0: bell compile 2.51 ms, 9040 prefixes 778 ms; bell/composite/toolbar frames 46.4/31.4/26.5 µs; toolbar compile 5.00 ms. Absolute measurements, not a claimed baseline comparison. |
| `npm run typecheck`, `npx eslint .`, `npx prettier --check .` | Exit 0 each. |
| `node tools/modules.ts --check` | Zero stale files. |
| Schema / browser / AniML generation | Schema regenerated with no diff; 27 browser entries current; 407 AniML files checked. |

Sizes, min+gzip: host-edit **3143/4096 B**; core+web **20109 B**, unchanged; host **4042/4096 B**,
unchanged; full-featured **95965 B**, +2390 from the supplied 93575 B baseline; Rive-class **100701 B**.
This branch adds less than the P5b 6 KB allowance; combined wave integration is still the parent's
measurement responsibility. No shipped runtime dependency was added.

## Failures and corrections

- Missing local development dependencies blocked the first scaffold attempt; npm ci restored them.
- All 54 required scaffold dry/run commands reject host-edit's name; first runtime registration also
  rejects it. The documented temporary runtime key is hostedit; no protected validator was edited.
- Initial browser fixtures needed explicit child assets and an HTTP base URI instead of about:blank.
  One cold bundle-build case hit 30 seconds; final cached-artifact runs pass with the same limit.
- A namespace-based static type augmentation failed ESLint; the optional entry now exports a typed
  constructor, with no lint-rule suppression.
- First broad run: 4926 passed, 9 failed, 43 TODO. Seven existing Firefox cases timed out under broad
  concurrency; the demo checked cache before build finished; the new example was noncanonical.
  Built artifacts first, formatted the example through anima fmt, then passed the same scope with
  one worker (4936) and the final metadata follow-up with two workers (4938). Limits unchanged.
- Native invocation initially supplied the command file as another positional argument; corrected
  to --commands=commands.txt. Final native capture exits 1 intentionally because attempted list and
  instance verbs are unsupported; exact rejections and skip evidence are retained.
- Broad canvas tests emit unformatted ignored metric JSON; the first global formatting check found
  that output. Preserved raw files in /tmp/host-edit-canvas-final-output and removed generated output
  before the green final formatting check. No metric, oracle finding or measurement input changed.

Seven pending rows and the integration limits above remain explicit. Shared AUTHORING inclusion,
spec chapter / CLI docs topic support, global rebinding, component-valued data and URL-keyed parsed
file/asset reuse require the parent or owning modules. No parity status was promoted.

# A11Y report

- Status: implemented on `issue-a11y`; broad verification limited by shared-load timeouts.
- Issues covered: #32, #33, #34.
- Verify: 22 Chromium/Firefox regressions pass; typecheck, lint, format, generated checks and full size pass. Broad changed scope exits 1; serial owned-file retry passes 145/146; its one timeout passes when rerun alone. Full changed scope remains non-green under shared load.
- Sizes before → after (min+gzip B): core+web 22,564 → 22,575; a11y 2,339 → 2,357; a11y-actions 1,095 → 1,099; a11y-dom 2,163 → 2,158; focus 3,352 → 3,365; new optional a11y-navigation 0 → 659 (budget 1,536). No existing ceiling changed.
- Deviations: toolbar/grid navigation is an optional entry because a11y-dom had only 13 B of headroom; conformance assertions stay in the owned module test tree. Optional disabled-scope validation warning omitted to preserve the focus entry's tight budget (91 B remaining).
- Open problems: full changed scope is not green under shared load; unrelated files were not modified. Integration requests below.

## #32 — synchronous semantic action events

Repro: an overlay button with `activate="go"`, trigger `go` transitioning layer `l`
from `idle` to `done`, and `emit="sent"` on entry. The browser presses Enter and
checks the reached state, the exact event count, and state notifications. A nested
component repeats the same test and expects `child.sent` and `child/l`.

Cause: the host semantic action called `player.step(0)` directly and discarded its
result, bypassing the scheduled step's event and state dispatch.

Fix: `icon.semanticAction` calls the small host `flush()` seam, which calls the
existing private step path. Drawing, event hooks, nested events, stale-player
guards, state comparison and notifications now share exactly the scheduled path.
Browser tests also cover semantic focus listeners and numeric increase actions.
The host seam is isolated in commit `0cdf63a0`.

Proof: `proof/32-before.txt`, `proof/32-after.txt`;
regressions: `modules/a11y-dom/test/web/issues.test.ts`.

Decision (decided, owner may revisit): reuse the existing host dispatch path rather
than duplicate its events/state/lifecycle rules in an optional module. This follows
[the runtime research](../../docs/research/rive-web-runtime.md), “Lessons for Anima”
5 and 12: synchronous input application and push notifications.

## #33 — disabled focus scopes remain semantic

Repro: a `tab-list` group declares `focus.enabled=false`, `scope=true`,
`edge="closed-loop"`, with enabled child tabs. The test checks the parent's hidden
attribute, actual browser accessibility snapshot, DOM focus and wrapping arrows.

Cause: focus refresh set `hidden` on all unavailable logical focus targets, including
semantic containers. The browser therefore hid the complete semantic subtree.

Fix: only nonsemantic focus proxies are hidden for focus ineligibility. Semantic
visibility stays under the semantic tree's ownership. Ineligible targets lose
sequential focus without removing their role/subtree. Focus changes also preserve
semantic roving tab indices instead of resetting all inner controls to zero.

Proof: `proof/33-before.txt`, `proof/33-after.txt`.

Decision (decided, owner may revisit): omit the optional validation warning under
the fixed focus budget. The runtime behavior is corrected without a new diagnostic.
No screenshots are needed: these are semantic/focus bugs; the browser accessibility
snapshot and focus assertions are the observable evidence.

## #34 — toolbar and grid native roving

Repro: role vocabulary rejects toolbar/grid/row/gridcell before navigation can run.
The baseline tests load these roles and fail with `bad-value` at the role pointers.

Fix: register all four roles in the existing JSON/AniML shape; gridcells become
implicit focus targets with a11y-actions and focus. New optional browser entry
`@anima-format/web/a11y-navigation` includes a11y-dom and supplies toolbar/grid
roving. Existing tab/radio navigation stays in a11y-dom.

Toolbar: one stop, both arrow axes, wrapping, Home/End, focus ordering, disabled
item exclusion and browser Tab exit. Grid: direct semantic rows/cells; horizontal
roving within a row, vertical same-column movement, row Home/End, grid
Ctrl+Home/End, one stop, row edge stop/closed-loop/parent-scope. Disabled or missing
vertical targets retain focus; Page Up/Down bubble without prevention. Navigation
also works without logical focus. The entry adds no Player.step or draw hook.

Proof: `proof/34-before.txt`, `proof/34-after.txt`. Module-owned conformance case:
`modules/a11y/test/core/issues.test.ts` uses `runScript` and independent explicit
role/action/focus/event/settled expectations. The paired example is
`modules/a11y-dom/examples/navigation.{animl,ani}`. Both syntaxes round-trip, and
the generated schema includes the new roles. The spec documents the new optional
import, structure, unavailable-cell policy, edges and page-owned keys.

Decision (decided, owner may revisit): a separate optional browser entry preserves
the existing 2,176 B overlay ceiling. Keep row/column navigation structural rather
than geometric; only parent-scope escape delegates to existing spatial traversal.
No parity scaffolder was run: these are extensions to existing complete role/focus
capabilities, without a new inventory row. No Rive code, CLI text, or `.riv` files
were used. Browser behavior is the oracle for this DOM-only capability, as in
`modules/a11y-dom/oracle/SKIP.md` and the existing overlay contract.

## Verification

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run format:check`: exit 0; subsequent report/source formatting checked separately.
- `node tools/modules.ts --check`: exit 0.
- `npm run gen`, `node tools/build-animl.ts --check`, `node tools/parity.ts --check`: exit 0.
- `node tools/build-web.ts`: exit 0, 71 browser entries.
- `node tools/size.ts`: exit 0, all entry and aggregate ceilings pass. See `proof/34-sizes-{before,after}.txt`.
- New issue browser regression file: exit 0, 22 passed across Chromium/Firefox.
- `npm run test:scope -- changed`: exit 1; 341 files passed, 51 failed, 12 skipped; 7,197 tests passed, 161 failed, 2,870 skipped, 34 todo. Failures are timeouts and setup/teardown errors following them; no assertion failure is reported. This includes three timeout failures in the issue regression file that passed in isolation.
- Serial retry of the seven affected owned browser files: exit 1, six files passed, one failed; 145 tests passed and one existing Firefox overlay test timed out at 5 s. See `proof/34-retry.txt`. That remaining Firefox overlay test passes when rerun alone (exit 0, one passed / 43 skipped). Every owned browser case therefore passes in the isolated runs; the full changed-scope result remains non-green.

Final aggregate gates (B min+gzip): core+web 22,575 / 24,576;
largest scene 57,545 / 65,536; app-UI 107,665 / 131,072; runtime sum
134,250 / 163,840; authoring add-on 15,006 / 16,384; Rive-class
153,312 / 256,000.

Baseline touched-entry sizes came from `tools/size.ts` before its long scene sweep
was stopped (exit 143); the final full size command finished with exit 0. Timings on this shared machine are not perf evidence;
no ≤3% claim is made. Ordinary scenes acquire no new step/draw work.

The initial isolated baseline run exceeded its 30 s bundle setup timeout under
shared load; rerunning the file with a 60 s setup allowance produced the intended
seven baseline failures. Test bodies have explicit 30 s timeouts. The first focused
scope passed 1,601 tests (638 skipped, one todo) before final lifecycle/order checks.

## Requests

- Integrate the isolated host hook commit `0cdf63a0`: `AnimaIcon.flush()` is the one
  small addition to `packages/web/src/index.ts`, owned by another ticket.
- Regenerate `examples/web/index.html` during integration with
  `node tools/build-web.ts`. It is generated locally for verification but excluded
  from this ticket's commits because it is outside the assigned files. Generated
  module wiring, the new adapter/export, and the registry-derived schema are included.

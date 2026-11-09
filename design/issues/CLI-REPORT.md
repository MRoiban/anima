# CLI report

- Status: implemented on `issue-cli`.
- Issues covered: #28.
- Verify: nine focused regression tests pass (11.43 s total); lint, formatting, CLI typecheck and all size gates pass. Broad checks encountered load timeouts; see below.
- Sizes before → after: all 70 shipped dist JS files byte-identical; core+web gate 22,564 → 22,564 B gzip.
- Deviations: current HEAD already supports composing separately loaded dist modules; recorded a passing browser regression instead of inventing a collision. `package-lock.json` updated with the authorized CLI dependency change.
- Open problems: full changed-scope verification did not complete; unrelated timeout cases passed in isolation.

## #28 — chosen-module bundle

Repro: `node packages/cli/src/main.ts bundle` exits 2 with `unknown command "bundle"`.
The new command tests failed against the starting tree, including the combined-browser test,
which could not reach the browser because the CLI rejected `--modules`.

The additional reported collision does not reproduce at starting HEAD: loading the paint and bind
dist files registers both, and renders a scene with a gradient and bound radius 7. `git log -S`
traces active-class registration to `ca2ee801` (paint) and `fdcc4cc2` (bind). Bind already used
`customElements.get('anima-icon').registerModule(bind)` in its introduction, so there is no earlier
faithful two-dist collision to capture. The earlier malformed-gradient experiment was corrected
before saving the reproducible before proof.

Cause: there was no supported CLI wrapper around the internal browser pipeline. The shipped dist
entries each contain their own core/web code even though their registrations now compose.

Fix: `anima bundle [--modules paint,bind] [-o anima.js] [--verbose]` invokes the shared esbuild,
terse-flags and terser pipeline. Single entries use their actual dist entry point, preserving exact
bytes. Combined entries share one dependency graph. Names and canonical order come from
`webOwners`, generated from topologically ordered manifests. The command de-duplicates names and
reports minified/gzip bytes; JSON output includes output path, ordered entries, verbose and sizes.
Unknown names produce `bundle-module`, `/modules/<index>`, a message and an edit-distance suggestion.
CLI dependencies now explicitly include esbuild and terser; core/web dependencies are unchanged.

Proof: `design/issues/proof/28-before.txt`, `design/issues/proof/28-after.txt` and the retained
`packages/cli/test/bundle.test.ts`. Browser checks use Chromium headless shell 1248. The combined
bundle registers both modules and renders the bound circle with a linear gradient. Additional tests
cover dist equality, sizes, default output, verbose messages, unknown/malformed names, usage,
duplicate elimination and manifest ordering independent of user order. Each test has a 30 s maximum
where it builds or opens a browser; the focused file passes in under 30 s total.

Decided, owner may revisit: accept every registered browser entry (including authoring add-ons),
not only primary module names. `after` orders selected entries without auto-selecting ordering-only
dependencies. Use Node's default gzip level (6) for the CLI's reported transfer size; repository gates
continue using level 9. The checkout-only support boundary follows the existing private-package
setup. This keeps the self-contained ESM direction in `docs/research/rive-web-runtime.md`,
“Lessons for Anima” §10, without adding runtime dependencies or per-frame work.

## Bundle sizes

CLI gzip uses level 6; these outputs are new commands, so no prior CLI size exists.

| Output | Minified bytes | Gzip bytes |
| --- | ---: | ---: |
| Base | 59,230 | 22,586 |
| Paint | 71,093 | 26,645 |
| Bind | 64,390 | 24,456 |
| Paint + bind | 76,314 | 28,567 |
| Base verbose | 65,760 | 25,394 |

Base, paint and bind output bytes equal their dist equivalents. The combination orders bind before
paint according to manifests, regardless of the user's spelling order.

## Verification

- Focused: `npx vitest run --project unit packages/cli/test/bundle.test.ts`: 9/9 pass; final single-worker repeat also passes in 26.69 s (under 30 s total).
- Initial broad `npm run test:scope -- changed`: stopped after multiple browser setup timeouts
  under severe shared load; rerun with `VITEST_MAX_WORKERS=2`.
- `node tools/build-web.ts --check`: all 70 bundle contents and the tracked demo unchanged;
  only ignored `dist/build.json`'s fingerprint was stale after the tool/lock edit. Refreshed its
  fingerprint after verifying contents. No shipped bundle bytes changed.
- No Player.step or draw-path changes; no perf claim under shared load.

- `npm run lint`, `npm run format:check`, `npx tsc -p packages/cli`: exit 0.
- `node tools/size.ts`: exit 0; every gate and per-entry budget passes. Largest scene 57,505 B,
  app-UI 107,630 B, runtime sum 133,491 B, authoring 15,006 B, heavy 152,563 B.
- Bounded changed-scope rerun: stopped after six a11y overlay Firefox timeouts; the sampled
  `maps every role` failure passes in isolation (18.02 s, 1 pass/43 deselected). This is not
  a clean complete changed-scope run, and no claim is made that all tests passed.
- CLI scope was stopped after five existing image/audio/video timeouts; it did not complete. Isolated single-worker rerun
  of those exact tests in `modules/assets/test/cli/pipeline.test.ts`,
  `packages/cli/test/commands.test.ts`, and `packages/cli/test/p3c-tooling.test.ts`: 5 pass,
  45 deselected, exit 0, 21.88 s. Both initial failures and isolated results are recorded in proof.

## Requests

None. No PR opened, per the integration brief.

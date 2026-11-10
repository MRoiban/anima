# Issues #39 and #40: report

- Status: done. Branch `issues-39-40` from main.
- Coder: Codex Web (GPT-5.6 Sol); the stream dropped after the fixes and proofs were committed, and
  the orchestrator ran the verification and wrote this report.
- Verify (orchestrator, frozen tree):
  - `npm run test:scope -- core web paint canvas --no-browser`: 5,745 passed, 16 todo;
  - canvas corpus and web browser tests: 2,692 passed (Chromium and Firefox);
  - `node tools/oracle.ts --strict`, size, lint, typecheck and format check: all exit 0.
- Sizes: core+web 22,808 B (ceiling 24,576 B); no budget or threshold changed.

## #39: trimmed stroke with a round cap painted a dot at the far endpoint

- **Repro:** `packages/core/test/issue-39.test.ts` (the issue's `f9` scene), and a canvas pixel check
  in `modules/canvas/test/web/canvas.test.ts`. Proof: `proof/39-before.txt`, `proof/39-after.txt`.
- **Cause:** the trim dasharray `[len × L, (1 − len) × L]`, rounded to 5 decimals, sums to the path
  length, so the dash pattern repeats at the endpoint and its round cap draws a dot.
- **Fix:** for a trim that does not wrap (`start + len ≤ 1`), the gap is `2 × L`, so the dash cannot
  repeat. A wrapping trim keeps the exact gap `(1 − len) × L`. The same rule applies in SVG
  (`packages/core/src/svg.ts`) and in canvas `setLineDash` (`modules/canvas/web/renderer.ts`).
  `modules/paint/test/core/paint.test.ts` now expects `10 40`, not `10 10`, for a non-wrapping trim.

## #40: SVG transform rounding turned tiny scales into 0

- **Repro:** the issue's `f10` scene, with a regression test. Proof: `proof/40-before.txt`,
  `proof/40-after.txt`.
- **Cause:** `matrix()` formatted entries with `fmt` (5 fixed decimals), so |v| < 0.000005 became 0
  and the nested inverse scale could not recover the geometry.
- **Fix:** matrix entries use six significant digits (`Number(v.toPrecision(6))`). Other number
  formatting is unchanged. Canvas and hit testing already used unrounded matrices. No recorded SVG
  expectation changed (5,745 unit tests pass).

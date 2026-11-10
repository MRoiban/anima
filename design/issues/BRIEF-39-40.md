# Issues #39 and #40: brief

Read `AGENTS.md`, `WORKLOG.md` (Gotchas) and `design/issues/BRIEF.md` (the issue process: reproduce,
proof before and after, fix, regression test). Read both issues with `gh issue view <n> --comments`.
Work on branch `issues-39-40` from `origin/main` (not from `p8-rigging`). Commit small steps.
Report: `design/issues/39-40-REPORT.md`; proof: `design/issues/proof/{39,40}-{before,after}.txt`.

- **#39: trimmed stroke with a round cap paints a dot at the far endpoint.** `packages/core/src/svg.ts`
  emits the trim dasharray as `[len × L, (1 − len) × L]`, rounded to 5 decimals, so the pattern
  repeats at the endpoint. Fix: for a non-wrapping trim, make the gap longer than the remaining
  path (for example `L × 2`), so the dash cannot repeat. Wrapping trims (`offset`) keep their exact
  gap. Check the canvas backend too: Canvas2D `setLineDash` has the same pattern. Repro: the
  issue's `f9.animl`; prove the second dash is gone (dasharray, plus rendered pixels at the far
  endpoint in the CLI PNG and a browser).
- **#40: SVG transform rounding turns tiny scales into 0.** `matrix()` in `packages/core/src/svg.ts`
  formats entries with `fmt` (`Math.round(v × 1e5) / 1e5`). Fix: format matrix entries with
  relative precision (for example `Number(v.toPrecision(6))`). Leave other number formatting
  unchanged unless the issue requires it. Repro: the issue's `f10.animl`; prove the square is drawn
  (matrix text, and pixels in the CLI PNG and a browser). Check the canvas backend and hit testing
  use unrounded matrices.
- Guards:
  - core+web ≤ 24,576 B; report the delta.
  - Existing tests and the strict oracle stay green, with no threshold changes. A changed static
    SVG byte expectation must be justified in the report.
  - The ≤ 3 % per-frame guard: no added work per frame beyond formatting.
  - Conformance cases if `Player.step` output changes; it shouldn't.
- Verify:
  - `npm run test:scope -- core web canvas oracle --browser=chromium`, then Firefox once;
  - `node tools/size.ts` (exit 0);
  - `npm run lint`, typecheck, and `npm run format:check`.
- Don't open a PR; the orchestrator does that.

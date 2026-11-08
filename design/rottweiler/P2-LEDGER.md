# Rottweiler ledger — P2 (45d019aa..b1941c9f, PR #8)

Scope: CLI glyph inspection (`glyphs.ts`, `inspect`), `render --compare` (`render.ts`, `cli.ts`), `schema`
object topics, script `values` input picking, bool `a11y.activate` (core load, `<anima-icon>` keys).

Round 1 (P2 lead; reviewer GPT-6.1-sol xhigh; token usage: not reported). Full review of the current code of the P2 hunks.

| id | sev | finding | outcome |
|---|---|---|---|
| R1-1 | major | `aria-checked`/`aria-pressed` refreshed only on machine state change: a switch whose bool `activate`/`pressed` input has no machine stays `aria-checked="false"` after Enter | fixed: `#aria()` runs after every host step; the attribute writer skips unchanged values (packages/web/test/browser.test.ts "updates aria-checked when Enter toggles a switch bool without a machine", Chromium+Firefox) |
| R1-2 | minor | replacing a switch document with a button (or `destroy()`) leaves the old `aria-checked`/`aria-pressed` | deferred: `#aria` is M4 (P0) code, unchanged by P2; for the P0 lead |
| R1-3 | major | `render --compare --browser-text` skipped the reference's viewport/ink normalization (`color="red"` → FAIL, 40×20 → dimension error) | fixed: the reference goes through `comparisonSVG` on that path too (packages/cli/test/p2-rottweiler.test.ts). `--browser-text` is P6's; the change is one line in the P2 compare branch |
| R1-4 | major | `render --compare` returned before validating/running `--frames`/`--fps`, `--probe`, `--audio` (and ignored `--viewport`/`--scale`/`--fit`): exit 0 with the extra mode silently skipped | fixed: those flags with `--compare` are a usage error (exit 2) (packages/cli/test/p2-rottweiler.test.ts) |
| R1-5 | minor | root `style` with `"` (single-quoted) or a newline broke comparison normalization (XML parse error / duplicate `style`) | fixed: multiline match, `"` escaped as `&quot;` (packages/cli/test/p2-rottweiler.test.ts) |
| R1-6 | minor | cubic extremum lost to cancellation in the quadratic root formula (`M0 0C10000 0 0 0 -29999.999999999993 0` → maxX 0, true 3750) | fixed: cancellation-free roots `q/A`, `C/q` (packages/cli/test/p2-rottweiler.test.ts) |
| R1-7 | minor | `held` follows the last key event: hold Enter, hold Space, release Enter → `held` false while Space is down | deferred: `#hold` is M4 (P0) code, unchanged by P2; for the P0 lead |

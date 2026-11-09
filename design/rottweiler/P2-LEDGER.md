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

Round 2 (P2 lead; reviewer GPT-6.1-sol xhigh; token usage: not reported). Scope: round-1 fix diff (b1ecf473) plus `schema` object topics, script `values` picking, bool `activate` validation/spec, `inspect` glyph output. No defects in schema, snapshot picking, activation validation, event order or the cubic roots.

| id | sev | finding | outcome |
|---|---|---|---|
| R2-1 | major | R1-1 regression: per-step `#aria()` rewrote host role/visibility, so a focus-module host without root a11y lost `role="group"` and became `aria-hidden` after any step | fixed: only the pressed/checked attribute refreshes per step (`#pressed`, skips unchanged values); full `#aria()` back on state change only (modules/focus/test/web/focus.test.ts "keeps the group role without root a11y across host steps", Chromium+Firefox; test file owned by the focus phase) |
| R2-2 | minor | `inspect` crashed on `"glyphs": {"$comment": …}` (validate accepts it) | fixed: skip `$comment` (packages/cli/test/p2-rottweiler.test.ts) |
| R2-3 | minor | compare root normalization broke on `>` inside a root attribute value and on a self-closing `<svg …/>` | fixed: quote-aware root tag match, self-closing kept (packages/cli/test/p2-rottweiler.test.ts) |

Round 3 (P2 lead; reviewer GPT-6.1-sol xhigh; token usage: not reported). Scope: round-2 fix diff (7bd10b9b). `#pressed()` held against module ARIA owners, state-notification order, unchanged writes, destroy and document swaps during events: no defects.

| id | sev | finding | outcome |
|---|---|---|---|
| R3-1 | minor | compare normalization rewrote an `<svg` inside a leading comment/doctype instead of the real root (wrong verdict or malformed XML) | fixed: skip the prolog (declaration, comments, PIs, doctype) before matching the root (packages/cli/test/p2-rottweiler.test.ts) |
| R3-2 | minor | namespace-prefixed root (`<s:svg …>`) not normalized → raster dimension error | fixed: root name may be prefixed and is preserved (same test) |
| R3-3 | minor | attribute-like text inside another attribute's value (`data-note=' style="opacity:0"'`) became the root style | fixed: whole root attributes are tokenized; only real `width`/`height`/`color`/`style` are replaced (same test) |

Round 4 (P2 lead; reviewer GPT-6.1-sol xhigh; token usage: not reported). Scope: round-3 rewrite of `comparisonSVG` (3b140268) and remaining P2 scope. BOM, spaced `=`, prefixed roots with style/color, `xml:space`, uppercase `WIDTH`, multi-MB content/prologs, unterminated comments/quotes: no defects. No further defects in the rest of P2.

| id | sev | finding | outcome |
|---|---|---|---|
| R4-1 | minor (realistic) | a root without `viewBox` (`width="20" height="20"`) had its size replaced without scaling: false FAIL at any `--size` but 20 (also `--browser-text`); present since P2 | fixed: a missing viewBox is derived from unitless/px intrinsic width and height (packages/cli/test/p2-rottweiler.test.ts) |
| R4-2 | minor (contrived) | quadratic attribute scan on trailing root whitespace (100,000 spaces: ~15 s) | fixed: trim before tokenizing (packages/cli/test/p2-rottweiler.test.ts) |

Round 5 (P2 lead; reviewer GPT-6.1-sol xhigh; token usage: not reported). Scope: round-4 fix (b5214b08) and a last pass over the whole P2 fix diff. Plain/px sizing, existing and generated viewBoxes, prefixed attributes, trailing whitespace and the earlier fixes: no defects. Percent/relative units and a lone width or height stay outside the fallback (they give no user space).

| id | sev | finding | outcome |
|---|---|---|---|
| R5-1 | minor (realistic) | the derived viewBox rejected valid SVG numbers (`2e1`, `+20`, `20.`) → false FAIL | fixed: SVG number syntax, converted to a finite positive number (packages/cli/test/p2-rottweiler.test.ts) |
| R5-2 | minor (contrived) | discovery lowercased names: an ignored `viewbox` suppressed the derivation (and `WIDTH` fed it) | fixed: exact-case `viewBox`/`width`/`height` (same test) |

Stopped after round 5 (the brief's limit); round 5 returned only minors in the R4-1 fallback.

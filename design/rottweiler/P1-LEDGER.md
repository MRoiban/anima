# P1 / P1 AniML Rottweiler ledger

Phase range: `19019232^1..45d019aa` (PRs #1–#7: M0 spec, M1 loader, M2 player, M3 CLI, M4 web
element, phase-A parity, P1 AniML), reviewed as the current code on a branch from `p8` (698693e2).
Reviewers: GPT-6.1-sol, reasoning effort xhigh, one per round.

| id | severity | finding | outcome |
| --- | --- | --- | --- |
| P2 R1-2 | minor | web (deferred by the P2 lead): `#aria()` set `aria-checked`/`aria-pressed` only when the document has `a11y.pressed`, so loading a document without it (or switching role switch ↔ button) left the previous document's attribute on the host | fixed: `packages/web/src/index.ts` removes the attribute the current role does not use and the used one when there is no `pressed`; `packages/web/test/browser.test.ts` ("Rottweiler P1 (P2 R1-2)") |
| P2 R1-7 | minor | web (deferred by the P2 lead): `held` followed the last key event, so releasing Enter while Space was still down set `held` false (SPEC §a11y: true while either key is held) | fixed: the host tracks the held Enter/Space keys and clears them on blur, load and destroy; `packages/web/test/browser.test.ts` ("Rottweiler P1 (P2 R1-7)") |
| R1-01 | major | player: timeline event enumeration capped at 10,000 periods per step (10,001 events for 20 s of a 1 ms loop), and after `step(1e20)` the next `step(0)` looped forever because the period index satisfied `k + 1 === k` | fixed (hang): `packages/core/src/player.ts` counts repeats instead of incrementing `k`; `packages/core/test/rottweiler-p1.test.ts`. The truncation part is pushed back: SPEC §5 keeps "the existing 10,000-period enumeration bound" normative |
| R1-02 | major | player: an event recognised within ε before the clock (§5) was reported again when reduced motion then froze the timeline at its end (the freeze filter compared with raw `>`/`<`) | fixed: the filter uses `reached`; `packages/core/test/rottweiler-p1.test.ts` and conformance `spec/conformance/reduced-motion-event-epsilon` |
| R1-03 | minor | player: `step(Infinity)` passed the `dt ≥ 0` check and left `time` at Infinity for good | fixed: `step` requires a finite dt (SPEC §7 says so); `packages/core/test/rottweiler-p1.test.ts` |
| R1-04 | minor | player: interpolating between finite keys `-1e308` and `1e308` overflows `b − a`, giving NaN at the first key and Infinity at the midpoint | pushed back: SPEC defines interpolation as `a + (b−a)·t`; an overflow-resistant lerp changes the last bit of ordinary interpolations, so every conformance expectation would need a determinism review, for values no icon uses |
| R1-05 | major | load: SPEC §2 allows `$comment` on any object, but the `inputs` map threw a TypeError, `colors` reported `bad-color` and `timelines` created a timeline named `$comment` | fixed: `packages/core/src/load.ts` iterates the three maps with the comment-filtering `entries()` (model colours are a filtered copy); `packages/core/test/rottweiler-p1.test.ts` |
| R1-06 | major | load: addresses such as `dot.constructor` or `dot.fill.toString` resolved through `Object.prototype`, loaded without diagnostics and put functions in `values()` | fixed: own-property lookups for property, paint-field and static-key tables; `packages/core/test/rottweiler-p1.test.ts` |
| R1-07 | major | ease/path: textual numbers overflowing to Infinity (`cubic(0,1e999,1,0)`, `elastic(1,1e999)`, `M1e999 0`) loaded and produced Infinity/NaN, although SPEC requires finite arguments | fixed: `packages/core/src/ease.ts` and `path.ts` reject non-finite parsed numbers (`bad-ease`, `bad-path`); `packages/core/test/rottweiler-p1.test.ts` |
| R1-08 | minor | path: a number token longer than 40 characters was cut by `slice(i, i + 40)` and rejected | fixed: a sticky regexp over the whole string; `packages/core/test/rottweiler-p1.test.ts` |
| R1-09 | minor | AniML: `"requires": []` decompiled to `requires=""`, which the compiler rejected (`bad-attribute`), breaking the ANIML §8 round trip | fixed: `packages/markup/src/compile.ts` accepts an empty `requires` list; `packages/markup/test/rottweiler-p1.test.ts` |
| R1-10 | major | AniML: a `$comment` containing `-->` was written into an XML comment verbatim, so the rest became markup (an injected `<number>` input on rebuild) | fixed: `packages/markup/src/layout.ts` writes `-->` inside comments as `-- >`, documented as a fourth decompile normalisation in ANIML §8; `packages/markup/test/rottweiler-p1.test.ts` |
| R1-11 | minor | XML: `&#0;`, `&#xD800;` and literal C0 controls were accepted, although ANIML §1 is a subset of XML 1.0 | fixed: `packages/markup/src/xml.ts` reports non-XML characters, literal or referenced, as positioned `markup-syntax` errors; `packages/markup/test/rottweiler-p1.test.ts` |
| R1-12 | minor | XML: a lone CR did not start a new line, so diagnostics after it had line 1 positions | fixed: line starts follow CR, CRLF and LF; `packages/markup/test/rottweiler-p1.test.ts` |
| R1-13 | major | hit test: open subpaths were dropped from fill containment, so a filled open triangle had no interior hits (SVG fills close them implicitly) | fixed: `packages/core/src/player.ts` tests fill containment on every subpath; `packages/core/test/rottweiler-p1.test.ts`, conformance `spec/conformance/pointer-painted-area` |
| R1-14 | major | hit test: a rect with `rx` hit as a square, e.g. (1,1) on a 20×20 rect with `rx` 10 | fixed: the hit outline uses the drawn corners (rx clamped to w/2, ry = rx clamped to h/2), flattened from the same arc path; tests as R1-13 |
| R1-15 | major | hit test: a stroke trimmed to nothing, or partly trimmed, still hit along its whole outline (§9: the painted area) | fixed: `packages/core/src/geom.ts` `trimPolys` cuts the outline to the visible trim window as `svg.ts` draws it (start + offset, wrapping); fill padding keeps the full outline; tests as R1-13 |
| R1-16 | minor | hit test: fixed 6° circle chords and 12-step cubics strayed more than the 0.05-unit tolerance on large curves (a radius-100 circle missed a point 0.1 inside) | fixed: circles/arcs use enough chords for a 0.05 sag (capped at 10⁴) and hit-test cubics get extra steps from a second-difference bound; small curves keep the old steps, so existing hits are unchanged. Residual: the tolerance is in local units, so a scaled-up node is coarser in world units; tests as R1-13 |
| R1-17 | major | web: `aria-checked`/`aria-pressed` refreshed only on machine state changes, so a switch whose pressed input changed without a state change kept a stale value | pushed back as owned elsewhere: the P2 lead is changing this ARIA refresh concurrently (refresh after every step); fixing it here too would conflict in the same lines of `packages/web/src/index.ts` |
| R2-01 | major | hit test (after R1-16): the tolerance-driven cubic step count was unbounded, so a valid huge cubic (`C0 1e100 …`) allocated until the heap ran out on the first pointer event | fixed: `packages/core/src/path.ts` caps the steps at 10⁴ per cubic and treats an overflowing (NaN) bound as no extra steps; `packages/core/test/rottweiler-p1.test.ts` |
| R2-02 | major | web: an `anima:event`/`anima:state` listener that queued input (e.g. `fire`) during a frame was unscheduled afterwards by the stale `settled` result, so the input waited until the next wake | fixed: `#step` sleeps only when the same player is no longer `busy`, and leaves scheduling alone when a listener replaced the player; `packages/web/test/browser.test.ts` ("Rottweiler P1 (R2-02)") |
| R2-03 | major | svg: a knockout's cut ignored stroke trims, so a stroke trimmed to nothing (or partly) still cut its whole stroke outline (SPEC §4: the painted area) | deferred: an exact cut for fill plus partial trim needs a second mask shape (fill grown by w, and the trimmed stroke grown by w), i.e. a `sceneTree` structure change that rewrites the bell fixtures and every retained renderer, plus the same change in `modules/canvas` (another phase) to keep the renderers identical. Owner: core SVG + canvas |
| R2-04 | major | CLI `inspect`: a `$comment` in the glyph map was inspected as a glyph and crashed | fixed: `packages/cli/src/cli.ts` skips `$comment`; `packages/cli/test/rottweiler-p1.test.ts` |
| R2-05 | minor | hit test (R1-16 residual): the 0.05 tolerance was in local units, so a scaled-up node (r 1, scale 100) missed a point 0.1 inside | fixed: the tolerance is divided by the world transform's largest singular value; path flattening is cached per tolerance; `packages/core/test/rottweiler-p1.test.ts` |
| R2-06 | minor | hit test (after R1-14): rounded corners went through SVG arc-to-cubic conversion, whose radial error (≈2.7·10⁻⁴·r) exceeded the tolerance for large radii | fixed: corners are sampled on the true ellipse with the circle chord rule (outline starting at (x + rx, y), clockwise); `packages/core/test/rottweiler-p1.test.ts` |
| R2-07 | minor | hit test (after R1-13): fill padding measured the distance to the open outline, missing points near an open subpath's implicit closing edge | fixed: fill padding uses the implicitly closed contours; `packages/core/test/rottweiler-p1.test.ts` |
| R2-08 | minor | hit test: an arc animated to `to < from` hit along a negative sweep that draws nothing | fixed: the hit outline clamps the sweep to [0, 360] as `draw.ts` does; `packages/core/test/rottweiler-p1.test.ts` |
| R2-09 | minor | hit test: strokes hit as round-capped/joined regardless of `cap` (a butt-capped line hits 1 unit beyond its end) | pushed back: SPEC §9 defines the stroke hit area as "the stroke within half its (world) width", the same for every cap and join; cap- and join-exact hit geometry would be a spec change |
| R2-10 | minor | ease (after R1-07): the finiteness check summed arguments, rejecting finite ones whose sum overflows (`cubic(0,1e308,1,1e308)`) | fixed: each argument is checked; `packages/core/test/rottweiler-p1.test.ts` |
| R2-11 | major | CLI `render`: failed script expectations and unfinished scripts (unclosed `group`) were ignored, writing the artifact and exiting 0 | fixed: `render` reports the script diagnostics and exits 1 before writing, and calls `session.finish()`; `packages/cli/test/rottweiler-p1.test.ts` |
| R2-12 | minor | CLI `new`: a digit-leading document name (`1up`) was used as the glyph name, which must start with a letter (`bad-name`) | fixed: `packages/cli/src/scaffold.ts` names the glyph `glyph-<name>` then; `packages/cli/test/rottweiler-p1.test.ts` |
| R3-01 | major | path flattening: a segment after `Z` without a new `M` continued the closed polygon from its last point instead of a new contour at the subpath start, so `M0 0L10 0L10 10ZL0 10` hit at (2,8) | fixed: `packages/core/src/path.ts` `flatten` starts a new contour at the subpath start after `Z`; `packages/core/test/rottweiler-p1.test.ts`, conformance `spec/conformance/pointer-hit-contours` |
| R3-02 | major | hit test: padding was divided by √det, wrong under a nonuniform scale (a `scaleX` 10 rect with `hitPadding` 1 hit 2 units right and missed 0.5 above) | fixed: the stroke is tested in local units, the padding on the world-space outline (fill contours closed; the stroke's half width at its narrowest stretch), equal to the old test under uniform scale; tests as R3-01 |
| R3-03 | major | web: an `anima:event` listener that replaced the document let the old step continue, dispatching the old player's state after the new one and overwriting `#states` | fixed: `#step` returns once a listener replaced or destroyed its player; `packages/web/test/browser.test.ts` ("Rottweiler P1 (R3-03, R3-05)") |
| R3-04 | major | CLI `validate`: the duplicate-key scanner recursed, so deeply nested metadata (accepted by `load`) overflowed the stack, the exception was swallowed, and duplicate keys went unreported (exit 0) | fixed: `packages/cli/src/locate.ts` scans iteratively (identical results on all 3,921 JSON files in the repo); `packages/cli/test/rottweiler-p1.test.ts` |
| R3-05 | minor | web: destroying the icon from an `anima:event` listener during `play()` threw (`this.player.busy` of undefined) | fixed: optional access after `#step(0)`; test as R3-03 |
| R3-06 | minor | hit test: SVG path arcs are hit-tested through the parser's ≤90° cubic conversion, whose radial error exceeds 0.05 for radii above about 185 | pushed back: SPEC already makes that conversion Anima's arc geometry (path lengths §"Core pathLength", clips "SVG arcs are converted to cubic curves by Anima's existing parser"); exact arcs would need arc segments kept through `parsePath` for one consumer, at radii far beyond icon grids |
| R3-07 | minor | AniML (lean compiler): any `<import`, `<template` or `<apply` in the source text, even in a comment, required the libraries compiler (`markup-libraries-unavailable`) | fixed: `packages/markup/src/compile.ts` reports it only for real library elements in the parsed tree; `packages/markup/test/rottweiler-p1-lean.test.ts` |
| R3-08 | minor | AniML decompile: a metadata `$comment` moved into a trimmed XML comment, so `" a "` became `"a"` and `"\u0000"` produced markup that does not build (ANIML §8 round trip) | fixed: `packages/markup/src/decompile.ts` keeps it in the `<meta>` JSON text; `packages/markup/test/rottweiler-p1.test.ts` |
| R3-09 | minor | CLI `build` (HTML): a script `type` spelled with character references (`&#43;`, `&plus;`) was not recognised, leaving the AniML for runtime compilation without a diagnostic | fixed: `packages/cli/src/html.ts` decodes numeric and the relevant named references before comparing; `packages/cli/test/rottweiler-p1.test.ts` |
| R3-10 | minor | script: `expect-error` could not catch a tokenizer error (unterminated string), which threw instead | fixed: `packages/core/src/script.ts` routes tokenizer errors through the pending expectation; `packages/core/test/rottweiler-p1.test.ts` |
| R3-11 | minor | load: the 1 MiB limit counted UTF-16 units, so 1.2 MB of UTF-8 (`é` × 600,000) loaded (SPEC §2: 1 MiB of text) | fixed: `packages/core/src/load.ts` counts UTF-8 bytes (only for text over 349,525 units; longer text is rejected directly); `packages/core/test/rottweiler-p1.test.ts` |
| R3-12 | minor | web: the `tabindex="0"` and pointer cursor the host adds for buttons stayed after a reload to a non-button document or `destroy()`, leaving an `aria-hidden` tab stop | fixed: `#aria()` removes only the values the host added (author values stay); `packages/web/test/browser.test.ts` ("Rottweiler P1 (R3-12)") |

## Rounds

### Deferred from P2 (before round 1)

P2 R1-2 and P2 R1-7, both reproduced in Chromium and Firefox (tests fail before, pass after).
Together the two changes put `assetio` (an incremental entry measured over core+web, so gzip noise from
any base change lands on it) at 770–774/768 B in all of about 40 equivalent spellings tried; with the
round-1 core changes the final tree measures 768/768.

### Round 1 (full)

Reviewer: GPT-6.1-sol xhigh, full review of the P1 runtime and tooling source (player step, loader
validation, AniML compiler first). Token usage: not reported. Seventeen findings; 16 reproduced by the
lead with the reviewer's scripts (R1-17 was the reviewer's browser repro, not re-run because it is
pushed back as owned by the P2 lead's concurrent ARIA refresh). Coverage reported: player, loader/checker, registry,
geometry/path/easing/colour, draw/SVG, six markup files, web element, CLI helpers and four tools
fully; `script.ts` and the CLI dispatcher partly.

Sizes (min+gzip): core+web 21,295 → 21,932 B (ceiling 24,576; mostly the hit-test fixes);
`markup` 7,319 → 7,424; `markup-libraries` 2,171 → 2,174/2,176 (the XML line-start loop is spelled
with `matchAll` because the first spelling measured 2,178); `assetio` 760 → 768/768. Browser tests: the
first scope run had 10 failures, all 30 s timeouts or 10 s launch-hook timeouts under load (load
average 16–25) plus one stale `build-web` cache; after `node tools/build-web.ts` each failing file
passed alone in Chromium, and `packages/web/test/browser.test.ts` passed alone in Firefox.

### Round 2 (focused)

Reviewer: GPT-6.1-sol xhigh: the round-1 fix diff plus `script.ts`, `check.ts`, draw/SVG, registry,
decompile/format/names, the web host lifecycle and the CLI. Token usage: not reported. Twelve findings, all
reproduced by the lead with the reviewer's scripts; five (R2-01, R2-05–R2-08, R2-10) were gaps in round-1
fixes. The reviewer found the other round-1 fixes correct (finite dt, event repetition count, ε filter,
own-property lookups, `$comment` maps, sticky path numbers, `requires=""`, comment rewriting, XML
characters, CR positions, ARIA cleanup, held keys). R2-03 deferred, R2-09 pushed back.

Sizes: the first round-2 spelling put `components` at 3,485/3,456 B, `assetio` 769/768 and
`markup-libraries` 2,178/2,176 (gzip-window effects of the larger `player.ts`, no duplicated code in the
bundles). A module-level arc sampler, a `hypot` spelling of the largest singular value and a shorter fill-
padding expression measure `components` 3,454, `assetio` 764, `markup-libraries` 2,176/2,176;
core+web 21,994 B.

### Round 3 (focused)

Reviewer: GPT-6.1-sol xhigh: the round-2 fix diff plus the web host's frame loop and lifecycle, loader
validation, script parsing, AniML round trips and `locate.ts`/`html.ts`. Token usage: not reported.
Twelve findings, all reproduced by the lead with the reviewer's scripts; R3-02 and R3-03/R3-05 sit next to
round-1/2 fixes (padding, the R2-02 scheduling line). All nine round-2 fixes were found correct. R3-06
pushed back. The R3-07 regression test runs in its own file because the full markup entry registers the
libraries compiler (a test beside the others passed before the fix).

Sizes: core+web 22,217 B; `components` 3,440/3,456, `assetio` 748/768, `markup` 7,446,
`markup-libraries` 2,172/2,176.

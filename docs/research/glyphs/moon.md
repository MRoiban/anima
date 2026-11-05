# Moon: CLI-only Glyphy authoring test

Author: implementation agent, 2026-11-05. Starting checkout: `61655d2`.
Time: approximately 8 minutes including setup, authoring, measurement and full checks
(observed UTC checkpoints 14:08–14:11; initial setup preceded the first timestamp).

## Result and scope

Brief items met: **6/6**, plus pixel-identical rest geometry. This counts the requested
accessibility metadata, with keyboard activation deliberately excluded as instructed.

- Click toggles `dark` (explicit default false). On: 0° → −30° anticipation → +5°
  overshoot → 0° over 0.6 seconds, pivot at the glyph-grid centre (10,10).
  Off: 0.24-second eased blend from the current rotation and star scales to rest.
- Three accent circles pop at 0.12, 0.20 and 0.28 seconds, overshoot to scale 1.25,
  then settle at 1. Their rest scales are 0.
- Both mode transitions explicitly use `interruptible="true"`; snapshot crossfades
  preserve values when toggled during either direction, including during the initial blend.
- A separate parent group scales to 1.05 on hover and 0.95 on press. Its layer
  writes only `interaction.scale`; the mode layer writes rotation and star scales.
- Reduced motion reaches the destination immediately, with `settled: true` at time 0.
- `role="switch"`, label `Dark mode`, `pressed="dark"`, `held="down"` validate.
  **No `activate`**: bool keyboard activation is being implemented separately.

The original path and its evenodd hole stay together, with identity rest transforms.
This follows the CLI guide's glyph/pivot advice and
[Glyphy compatibility §4.5](../glyphy-compat.md): preserve outline geometry and compose
transforms rather than retracing ink. SPEC §7's frozen interruption snapshot is the
reason for using a nonzero blend in both directions. The rotation is clockwise-positive.
The dark input is a switch state; host page colour/theme application is outside this asset.

Only CLI-served authoring/spec/markup docs taught the syntax. No `packages/*/src`
was read to learn the format. No Rive commands, files, source or documentation were used.
The source SVG, architecture and local Glyphy compatibility note supplied geometry/context.

## Reproduce

Commands below use `anima` as shorthand for `node packages/cli/src/main.ts`.

```sh
npm ci
anima docs
anima docs spec
anima docs markup
anima docs --list
anima new moon --glyph fixtures/glyphs/moon.svg -o examples/moon.animl
# Edit the scaffold: preserve its embedded glyph and add the documented nodes/machine.
anima validate examples/moon.animl
anima inspect examples/moon.animl
anima fmt examples/moon.animl --write
anima fmt examples/moon.animl --check
anima build examples/moon.animl -o examples/moon.ani
anima validate examples/moon.ani
node tools/build-animl.ts --check
anima render examples/moon.animl -o examples/moon-toggle.png --sheet 9 --over 0.64 --dark -e 'toggle dark; advance 0'
anima render examples/moon.animl -o /tmp/moon-rest.svg
anima render examples/moon.animl -o /tmp/moon-rest.png --size 320
npm run check
```

The contact sheet shows entry through settled dark. A script `toggle dark` rather
than a pointer click keeps hover out of this motion sheet. `inspect` reports disjoint
layer writes, no overlaps. Both validate commands say `ok`; formatting says `formatted`;
the corpus build check reports 15 AniML files.

## Sample evidence

```sh
anima sample examples/moon.animl -e 'toggle dark; advance 0; advance 0.24; snapshot; toggle dark; advance 0; snapshot; advance 0.06; snapshot; toggle dark; advance 0; snapshot; advance 0.000001; snapshot; advance 0.6; snapshot'
```

| Time (s) / action | moon.rotate (degrees) | star-a.scale | star-b.scale | star-c.scale |
| --- | ---: | ---: | ---: | ---: |
| 0.24 before off | -3.0715284671147387 | 1.1721474998290846 | 0.500989527124077 | 0 |
| 0.24 after off + advance 0 | -3.0715284671147387 | 1.1721474998290846 | 0.500989527124077 | 0 |
| 0.30 before on | -2.6748039190353863 | 1.0207506652788725 | 0.43628075236624775 | 0 |
| 0.30 after on + advance 0 | -2.6748039190353863 | 1.0207506652788725 | 0.43628075236624775 | 0 |
| 0.300001 | -2.67476551569738 | 1.0207360070790796 | 0.4362744872805108 | 0 |
| 0.900001, settled | 0 | 1 | 1 | 1 |

At each reversal the immediate delta is **exactly 0** across all animated values;
`interaction.scale` remains 1. After one microsecond, rotation changes only
0.0000384033380063 degrees. This checks positional continuity, not velocity continuity.
Re-entry restarts the on timeline through a blend: it does not run timeline time backwards.

Also checked interruption inside the initial 0.12-second blend:

```sh
anima sample examples/moon.animl -e 'toggle dark; advance 0; advance 0.08; snapshot; toggle dark; advance 0; snapshot; advance 0.02; snapshot; toggle dark; advance 0; snapshot; advance 0.5; snapshot; advance 0.6; snapshot; toggle dark; advance 0; advance 0.24; snapshot'
```

Rotation before/after off at 0.08: **−23.738408406571605** both times.
Rotation before/after on at 0.10: **−23.41545327659849** both times.
At 1.44 seconds, light is settled: rotation 0, all stars 0, parent scale 1.

A separate settled-dark → half-off → on trace at 0.72 seconds gave all star scales
**0.5 before and after re-entry**, with rotation 0. This covers interruption of a
fade that began with fully visible stars.

Stagger trace (`toggle dark; advance 0`, then snapshots at 0.16/0.24/0.32/0.34/0.60):

| Time | Rotation | Star A | Star B | Star C |
| --- | ---: | ---: | ---: | ---: |
| 0.16 | -16.765165 | 0.500990 | 0 | 0 |
| 0.24 | -3.071528 | 1.172147 | 0.500990 | 0 |
| 0.32 | 4.579396 | 1.173097 | 1.172147 | 0.500990 |
| 0.34 | 5 | 1.108484 | 1.240225 | 0.713600 |
| 0.60 | 0 | 1 | 1 | 1 |

```sh
anima sample examples/moon.animl -e 'pointer move 10 10; advance 0.16; snapshot; pointer down 10 10; advance 0.08; snapshot; pointer up 10 10; advance 0.6; snapshot; pointer leave; advance 0.18; snapshot'
anima sample examples/moon.animl -e 'motion reduce; pointer click 10 10; snapshot; pointer leave; snapshot; pointer click 10 10; pointer leave; snapshot'
```

Full motion: scale **1.05 → 0.95 → 1.05 → 1**; pointer release toggles dark.
Reduced: first click gives rotation 0, stars 1, hovered scale 1.05, settled true at
time 0; leave gives scale 1; next click/leave gives stars 0 and scale 1, settled true
at time 0. Accessibility is checked by validation of the declared contract; this test
does not claim a moon-specific screen-reader/browser accessibility audit.

## Rest parity

Compared the CLI's `/tmp/moon-rest.svg` against `fixtures/glyphs/moon.svg` using
cached Playwright Chromium and canvas ImageData, with identical colour `#141413`,
viewBox `0 0 20 20`, and raster dimensions. Compared every RGBA channel, not just alpha.
At **20×20, 240×240 and 320×320: 0 differing pixels, max channel delta 0**.
The root colour and raster dimensions were normalized for both SVGs; original path
geometry and fill rules were untouched. No runtime API was used for animation authoring.
This is pixel parity in Chromium at these resolutions, not byte-identical SVG output.

## Friction and failures (complete observed list)

1. **Missing checkout dependencies.** Command: `node packages/cli/src/main.ts docs`.
   Expected: guide. Actual: exit 1 before command dispatch:
   `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@anima-format/core' imported from /home/jarvis/.t3/worktrees/anima/t3-242a8572/packages/cli/src/cli.ts`.
   Ran the instructed `npm ci`; all subsequent CLI commands worked. Installation
   reported `10 moderate severity vulnerabilities` and an esbuild install-script
   warning; no dependency versions or audit fixes were changed.
2. **Rest parity requires a separate comparison harness.** Command:
   `anima render examples/moon.animl -o /tmp/moon-rest.svg`.
   Expected/actual: correctly writes the SVG (`wrote /tmp/moon-rest.svg`), but there
   is no comparison result. No CLI diagnostic; this is a workflow gap, not a failed
   render. A temporary external raster comparison supplied the evidence above.
3. **Continuity checks require manual snapshot comparison.** Command: the first
   reversal `anima sample` script above. Expected/actual: correct JSONL values,
   but no built-in continuity assertion or input values in the snapshot, so the
   script and explicit before/after rows must travel with the numbers. No diagnostic.
4. **Guide's keyboard advice is trigger-only on this checkout.** Command:
   `anima docs` (and `anima docs spec`). Expected: complete switch keyboard recipe.
   Actual guide sentence: `Keyboard activation uses a11y: activate names a trigger and held names a bool.`
   No diagnostic. Bool activation is the parallel task, so `activate` is intentionally
   absent; mouse toggling and required switch metadata work. No format blocker for
   the scoped task, and no workaround trigger was added.
5. **Comparison harness bug, not Anima.** Command: `node /tmp/moon-parity.mjs`.
   Expected: pixel counts. First attempt accidentally duplicated SVG root dimensions;
   actual: `page.evaluate: EncodingError: The source image cannot be decoded.`
   Removed the duplicate attributes and reran successfully at all three sizes.
   This failed verification attempt is not counted as product friction.

Product/setup friction points recorded: **4**; separate author mistake: **1**.
No AniML validation or compilation errors occurred. The docs were sufficient;
no implementation source inspection or changes were needed.

## Top three fixes, ranked

1. Add a documented CLI rest-parity check against the source SVG, using the existing
   renderer and reporting pixel counts. This would make the glyph preservation promise
   directly testable without an author-written browser harness.
2. Add a documented sample continuity assertion/diff mode (and optional input values
   in snapshots), so reversal scripts can fail automatically on a jump.
3. Finish the parallel bool `a11y.activate` support and document a complete switch
   recipe with reduced motion and interruption. Until then the example deliberately
   has no keyboard toggle binding.

## Verification and deviations

`npm run check` exited 0: **19 test files, 365 tests passed, no skips**
(56.43 seconds), including the Chromium and Firefox suites; typecheck, lint,
Prettier, size, build-web and build-animl checks all passed. Sizes: core+web
**14,781 / 25,600 B gzip**, markup **5,804 / 6,144 B gzip**. All **15 AniML**
build outputs are current. The full check ran after the assets were final; this
report was then formatted and checked separately. The contact sheet was visually
inspected: no clipping, three distinct staggered accents, settled final frame.
No moon-specific browser keyboard/accessibility test was added or claimed. No packages, spec, AUTHORING,
PLAN, LOG or WORKLOG edits: the task's explicit ownership restricts changes to
`examples/moon.*`, the requested `moon-toggle.png`, and this report. This overrides
repository-wide milestone/log/PR steps. No push, PR, merge, licence or dependencies
were added. No subagents were started.

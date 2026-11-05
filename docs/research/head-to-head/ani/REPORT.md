Format: hand-written `.ani` JSON (Anima 0.1)
Wall time (first command to done): 171 seconds (2.85 minutes).
First command: 2026-11-05 13:49:32 UTC. Finished: 2026-11-05 13:52:22 UTC.
Finish means authoring, checks, visual inspection, and report preparation complete; commit follows.
Check/validate/build runs: 11 (0 build runs; 0 errors in these 11 runs).
Source size: 81 lines, 2,427 characters (2,427 UTF-8 bytes), `switch.ani` only.

Brief items met (1–7), each with how you checked it:

1. Met. Explicit bool `on`, default false; whole-icon 20×20 rectangular hit area;
   click listener toggles it. `validate` accepts it. `toggle.jsonl` starts off and
   switches on/off from clicks at (1,1) and (19,19), outside the painted track.
   Every point was not exhaustively hit-tested; full coverage also follows from
   the declared hit rectangle and SPEC §9.
2. Met. `toggle.jsonl` verifies x translation 0→8 (centre 6→14), opacity 0→1,
   and the reverse. At 0.075 s translation is 1.0332954484 (not the linear 2),
   at 0.15 s it is 4, at 0.3 s it is 8 and settled. Both transitions explicitly
   use `inOut`. Static geometry checked by assertions: 20 grid, track (2,6),
   size 16×8, rx 4, ink outline 1.5; knob radius 2.6; exact requested colours.
   Visually inspected off.png, on.png, and slide.png (seven frames, 0–0.3 s).
3. Met. `interrupt.jsonl`: at 0.12 s x=2.6550709608 before AND after toggling;
   after 0.03 s moving back x=2.6027064471. Toggling again leaves that value
   unchanged, then reaches x=8. Opacity and scale also remain continuous at
   those interruption instants. This preserves position, not velocity.
4. Met. `interaction.jsonl`: hover scale 1.075 at 0.075 s and 1.15 at 0.15 s;
   leave returns via 1.075 at 0.075 s to 1 at 0.15 s.
5. Met. Same trace: press from hover reaches 1 at 0.04 s and 0.85 at 0.08 s;
   release starts at 0.85 and returns via 1 at 0.075 s to 1.15 at 0.15 s.
   Visually inspected press.png. Release duration was unspecified; chose 0.15 s.
6. Met. `reduced.jsonl`: both pointer-click and direct-input toggles reach x=8/0
   and opacity=1/0 at unchanged time 0, settled=true. SPEC §10 makes crossfades
   zero-duration under reduced motion; no timeline workaround is needed.
7. Declared and validated, browser behavior UNVERIFIED. `a11y` contains role
   `switch`, label `Dark mode`, and `pressed: on`. SPEC §10 says this maps to
   `aria-checked` for switches. JSON assertions confirm those fields and validate
   confirms the bool binding is legal. CLI sample does not expose DOM attributes;
   no browser or screen reader test was performed. Count: 6/7 fully verified,
   7/7 expressed in source; item 7 is not counted as fully verified.

Items not met or approximated, and why:

- Browser accessibility state propagation was not verified; see item 7. No claim
  is made about keyboard activation: no `activate` trigger was authored, and the
  brief did not explicitly request keyboard activation. This is a limitation for
  production accessibility even though the named role/label/binding are present.
- Track fill and outline are two identical rounded rectangles. Fading the fill
  node opacity leaves the outline fully opaque, matching the specified appearance.
- Interrupted travel restarts a 0.3 s eased crossfade from the current position;
  velocity can change. The brief requests no jump, not velocity continuity.
- No browser interaction or operating-system motion preference was tested; reduced
  motion was forced through the documented CLI script command.

What was hardest; what the docs or diagnostics got wrong or left out:

- Knowing that pose transitions alone handle both interruption and reduced motion
  required SPEC §§7–10; the historical guide emphasizes timelines for motion.
  Two disjoint-property layers suffice; `inspect` showed no overlapping writers.
- There is no paint alpha field in the documented format. A second track shape
  avoids fading the outline or interpolating quantized RGBA colour channels.
- The historical guide says schema lists node/property details. I tried schema
  topics `transition` and `a11y`; both are unsupported. The CLI correctly named
  supported topics; the full spec supplied the missing information.
- Initial CLI startup failed with ERR_MODULE_NOT_FOUND for @anima-format/core.
  The instructed `npm ci` fixed startup. It reported 10 moderate vulnerability
  advisories and an esbuild install-script warning; these were not icon errors
  and no dependency fixes were attempted.

Run accounting (each CLI invocation counted separately):

| Kind | Runs | Errors |
| --- | ---: | ---: |
| validate switch.ani | 1 | 0 |
| inspect switch.ani | 1 | 0 |
| sample → toggle/interrupt/interaction/reduced.jsonl | 4 | 0 |
| render → off/on/slide/press.png | 4 | 0 |
| Independent Python JSON/trace assertion check | 1 | 0 (55 assertions passed) |
| Total check/validate/build | 11 | 0 |

Additional setup/reference invocations, excluded from check count: `--help` twice
(first failed startup, second succeeded), `docs spec` once, `schema rect` once,
`schema transition` once, `schema a11y` once, `npm ci` once.
ALL observed errors including setup/reference: 3 — ERR_MODULE_NOT_FOUND ×1,
`no schema topic "transition"` ×1, `no schema topic "a11y"` ×1. No document
warnings or errors were reported. npm advisories/warnings are listed separately above.
No commands were retried silently. No build, decompile, scaffold, fmt or repository
suite ran. Generated PNG and JSONL files are evidence, excluded from authored
animation source size. No implementation or other-format source was consulted.

Resources used: BRIEF.md; historical AUTHORING.md via `git show 178a3a6:docs/AUTHORING.md`;
`anima docs spec`; the three schema queries above; examples/bell.ani. WORKLOG.md
and git history/status were read for the required workspace bookkeeping.

Trace reproduction (prefix every command with `node packages/cli/src/main.ts` and
use `docs/research/head-to-head/ani/switch.ani` as FILE):

```sh
sample FILE -e 'snapshot; pointer click 1 1; snapshot; advance 0.075; snapshot; advance 0.075; snapshot; advance 0.15; snapshot; pointer click 19 19; advance 0.15; snapshot; advance 0.15; snapshot'
sample FILE -e 'pointer click 10 10; advance 0.12; snapshot; pointer click 10 10; snapshot; advance 0.03; snapshot; pointer click 10 10; snapshot; advance 0.3; snapshot'
sample FILE -e 'pointer move 10 10; advance 0.075; snapshot; advance 0.075; snapshot; pointer down 10 10; advance 0.04; snapshot; advance 0.04; snapshot; pointer up 10 10; snapshot; advance 0.075; snapshot; advance 0.075; snapshot; pointer leave; advance 0.075; snapshot; advance 0.075; snapshot'
sample FILE -e 'motion reduce; snapshot; pointer click 1 1; snapshot; pointer click 19 19; snapshot; set on true; advance 0; snapshot; set on false; advance 0; snapshot'
render FILE -o off.png --size 240
render FILE -o on.png --size 240 -e 'set on true; advance 0; advance 0.3'
render FILE -o slide.png --size 240 --sheet 7 --over 0.3 -e 'set on true; advance 0'
render FILE -o press.png --size 240 -e 'pointer move 10 10; advance 0.15; pointer down 10 10; advance 0.08'
```

Format: AniML, authored by hand; compiled .ani included.
Wall time (first command to done): 210.3 s; finished 2026-11-06T04:07:20.263417+00:00 (verification and report complete; commit follows).
First command: 2026-11-06T04:03:50Z (actual clock; benchmark folder date is a label).
Check/validate/build/render runs: 13 total = 11 Anima invocations + 2 independent evidence-verifier runs.
Anima breakdown: validate 2, inspect 1, sample 5, build 1, render 2.
All 13 exited 0; no document diagnostics or assertion failures.
Setup errors: ERR_MODULE_NOT_FOUND (@anima-format/core), 4 occurrences from the first batched help/docs commands. Ran npm ci as instructed, then CLI worked. These four documentation attempts are additional to the 13 checks. npm ci reported 10 moderate vulnerabilities and an esbuild install-script notice; no install failure.
The second verifier run corrected its printed snapshot total (71 -> 84), not an assertion failure.
Source size: share.animl: 33 lines, 1635 characters. All authored source including WAV generator, check/verifier tooling and four sample scripts: 280 lines, 10839 characters. Excludes built .ani, generated binary WAV, report and evidence.

Brief items met (strict): 5/6, items 1, 2, 3, 4 and 6.

1. MET. motion.script starts with advance 0: count=0, scales=1, idle, settled, no events. Clicking increments to 1 and enters pulsing. Samples at 0.05 s intervals show left/top/bottom peaks of 1.3 at 0.15/0.20/0.25 s; each returns to 1 after its own 0.3 s interval, at 0.30/0.35/0.40 s. Circle pivots equal their centres, verified in built .ani; rest SVG verifies positions and radii. sheet.png visually inspected. repeat.script verifies each integer 1..25; high-count.script sets 999 AFTER initialization, then clicks to 1000. rapid.script verifies a second click at elapsed 0.15 resets all scales and increments to 2. Interrupted pulses restart (no overlapping independent pulses).
2. MET. At elapsed 0, motion.stdout reports {"name":"shared","layer":"main","time":0,"payload":{"count":1,"channel":"button"},"audio":"tone","volume":0.4}. It occurs on entry, while scales are still 1. repeat.stdout proves exactly one shared per click with the new count 1..25, at elapsed (count-1)*0.4. high-count.stdout reports count 1000. rapid.stdout reports count 2 at elapsed 0.15, event local time 0.
3. MET. No completion before elapsed 0.4; at elapsed 0.39999999999999997 (binary64 representation of 0.4), motion.stdout reports {"name":"pulse-done","layer":"main","time":0.4}, with no payload, and settles idle with unit scales. An extra second yields no further events. repeat.stdout verifies one completion per finished pulse. An interrupted pulse does not report completion; its replacement completes at elapsed 0.55, event local time 0.4.
4. MET as requested event/host intent. repeat.stdout reports milestone ONLY at counts 5,10,15,20,25 (elapsed 1.6,3.6,5.6,7.6,9.6; event local time 0), with url=https://example.org/thanks and target=_blank. high-count.stdout proves 1000 as well. No ladder or authored upper bound. CLI/core do not navigate; actual host tab opening was not tested or required. The icon supplies the URL and new-tab intent; host policy controls navigation.
5. PARTIAL / NOT STRICTLY VERIFIED. Every click's shared event carries audio=tone, volume=0.4 (asserted for all 25). tone.wav is an original, generated 80 ms mono 16-bit 22050 Hz decaying 660 Hz tone; make-tone.py reproduces it. WAV structure verified. Actual browser decode, source start, user-activation behavior and audible output were NOT verified by anima sample/render. No claim that the CLI plays sound.
6. MET. First snapshot: count 0, idle, settled, no events, unit scales. rest.svg contains exactly the two connected ink lines and three circles of radius 2 at the required centres, with stroke width 1.5, identity transforms and no added marks. Accent colour declared but unused because the brief assigns ink to the entire glyph. sheet.png ends at the identical unit-scale shape.

Items not met or approximated, and why:
- Item 5: audio request verified; audible playback unverified. CLI is deterministic and cannot establish browser playback.
- Rapid clicks restart rather than overlap an in-flight pulse. The brief does not specify overlap semantics; this choice is explicitly recorded.
- Testing finite examples cannot prove arbitrary IEEE-754 counts forever; count is an unclamped number input and milestones use mod(count,5), tested through 1000.

What was hardest; what the docs or diagnostics got wrong or left out:
- Docs were sufficient; no runtime implementation source or prohibited reference was read.
- Setup needed npm ci. The four initial help/docs calls were batched before their failures were visible.
- inspect prints a compiled JavaScript function for the expression-valued listener set instead of the authored count=count+1. See inspect.stdout. This is confusing inspection output but does not block behavior.
- Event time is timeline-local, not global: shared/milestone report 0 on each entry, pulse-done reports 0.4. Snapshot time records elapsed time; both are preserved in stdout evidence.
- The docs explicitly distinguish audio/URL delivery from core reporting. I did not equate the request with audible output or host navigation.

Evidence and reproduction:
- checks.jsonl records each of the 11 CLI invocations, arguments, timestamp and exit status; corresponding .stdout/.stderr files preserve all output, including empty streams.
- motion.script, repeat.script, rapid.script, high-count.script are executable anima sample inputs. motion also ran against built share.ani, yielding identical 12 snapshots. Total recorded sample snapshots: 84 (72 AniML + 12 compiled).
- Run python <this-directory>/verify.py from any directory to assert recorded evidence. verification.txt records the final result. Run check.py from the repo root to repeat a CLI command with a new ledger label.
- Rest SVG, contact sheet and original WAV are committed. No source code changes, pushes, PRs, merges, Rive commands or .riv file access.

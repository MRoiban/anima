Format: AniML, hand-written share.animl; CLI-built share.ani with embedded own audio.
Wall time (first command to done): 5 min 52 s.
First command: 2026-11-06 03:32:09 UTC.
Finished authoring/verification/report: 2026-11-06 03:38:01 UTC; local commit immediately afterwards.
The run directory date is prescribed; actual clock date is November 6.
Check/validate/build/render runs: 12 CLI runs; 15 including Python verification and two git whitespace checks.
Errors seen: ERR_MODULE_NOT_FOUND (@anima-format/core), 4 occurrences in the initial batched help/docs commands.
One additional tool orchestration SyntaxError prevented the first report-writing command from executing.
After npm ci: zero document diagnostics, sample errors, assertion failures, or build/render errors.
Install output separately reported 10 moderate audit vulnerabilities and an esbuild install-scripts warning.
Source size: share.animl 62 lines, 3,570 characters. Own audio: 3,572 bytes.
All authored text sources, including scripts, reference SVG, audio generator and verifier: 282 lines, 11,206 characters.
Breakdown: five sample/render scripts 148 lines / 3,565 characters; two Python files 71 / 3,715;
reference SVG 1 / 356; AniML 62 / 3,570. Built output, evidence, reports and work log excluded.

Brief items met (strict): 3/6 (items 3, 4, 6).

1. PARTIAL. count defaults to zero; first ten clicks increment it; click eleven and later retain 10.
   pulse.script samples peaks 1.3 at global 0.15/0.20/0.25 s for left/upper/lower, returning
   to 1 at 0.30/0.35/0.40 s. Pivots are the circles' centres. A click queues the counter-state
   entry listener; pulse/count update starts next step (explicit advance 0 in scripts).
   clicks.script proves saturation through click fifteen. No unbounded counter is claimed.
2. PARTIAL. At pulse entry, sample reports
   {"name":"shared","layer":"motion","time":0,"payload":{"count":1,"channel":"button"},"audio":"tone","volume":1}.
   First ten shared payloads contain counts 1–10; later ones contain 10 rather than a newly
   incremented count. All shared events coincide with pulse entry, with local timeline time 0.
   At click five, global time is 1.6 s and shared.payload is {"count":5,"channel":"button"}.
3. MET. Each completed pulse reports exactly
   {"name":"pulse-done","layer":"motion","time":0.4} (no payload).
   pulse.script checks the boundary and no duplicate on the following zero step. clicks.script
   checks fifteen completions at global times 0.4, 0.8, …, 6.0 s. interrupt.script restarts a pulse
   at global 0.1 s: no completion for interrupted pulse; one completion at global 0.5 s.
4. MET for requested host handoff. clicks.script reports milestone only on clicks 5/10/15,
   at global times 1.6/3.6/5.6 s. Every occurrence is
   {"name":"milestone","layer":"fifths","time":0,"url":"https://example.org/thanks","target":"_blank"}.
   Event.time is local state/timeline time, not global script time. The five-state cycle repeats
   indefinitely, independently of the bounded counter. Core/CLI do not navigate. A host must
   explicitly authorize opening; no actual tab opening was attempted or claimed.
5. UNVERIFIED playback; implemented event request only. Every click reports audio="tone", volume=1
   on shared. generate-tone.py creates an original non-silent mono 16-bit 22,050 Hz, 80 ms 660 Hz WAV.
   verify.py checks WAV header/data and byte-for-byte embedded asset. CLI sampling cannot prove
   browser decoding, user-activation handling, or audible output, so this item is not counted met.
6. MET. rest.script samples count=0, scale=1, no events and settled=true at global times 0 and 1 s.
   render --compare against expected-rest.svg (independently hand-transcribed from the brief)
   reports 0 differing pixels at 240 px, tolerance 0. Rest SVG has exactly two lines and three
   ink circles; no badge, background, or accent decoration. Accent is declared but unused.

Items not met or approximated, and why:
- Unbounded increment is not available in permitted docs: schema listener gives map<number|bool>
  literal set actions; spec §9 also describes literal bool/number values. Bind expressions write
  animatable properties, not root input values. Ten literal states approximate the counter.
  No implementation source was consulted and no host increment code was added to hide this gap.
- shared fields are correct for first ten clicks; thereafter count is saturated.
- Audio is verified as asset and event request, not as audible host playback.
- Repeat click restarts the current pulse (verified); overlapping independent pulses are not implemented.

What was hardest; what the docs or diagnostics got wrong or left out:
- Missing increment action is the main blocker; generic arithmetic bindings do not solve it.
- Next-step event listeners need an extra processing step before count and pulse update. This
  behavior is documented accurately, but makes a click counter surprisingly elaborate.
- Snapshots use local event times, so evidence must also retain global snapshot time.
- Bootstrap needed npm ci. Four learning commands were batched, hence four identical errors before
  install. No document iteration was required; validation passed first time.
- Events docs accurately disclose URL policy and audio activation gates. CLI evidence cannot establish
  actual browser host effects; this report does not equate metadata with playback.

Evidence/reproduction:
- evidence/runs.txt enumerates every check and error; exact command arguments retained.
- pulse.script, clicks.script, interrupt.script, rest.script, start.script exercise the document.
- evidence/*.jsonl retains complete raw snapshots, including internal state events and fields.
- evidence/rest.svg, rest.png, pulse-sheet.png, rest-diff.png show output; sheet inspected visually.
- python3 verify.py checks captured output and explicitly asserts the known click-eleven limit.
  Built .ani and source .animl have identical fifteen-click sample output.
- No competing-format materials, .riv files, oracle files, implementation source, network publishing,
  pushes, PR creation or merges used. Only benchmark directory and WORKLOG.md changed.

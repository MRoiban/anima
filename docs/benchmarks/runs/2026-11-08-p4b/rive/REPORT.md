Format: Rive markup, local Rive CLI project (`sync/`). No runtime scripts or external assets.
Wall time (first command to done): 0:05:19; first command 2026-11-06 00:36:48 UTC; finished authoring and verification 2026-11-06 00:42:07 UTC. Commit bookkeeping follows immediately. The machine date differs from the run-directory label; these are actual clock readings.
Check/validate/build/render runs: 14 overall, counted conservatively:
- 6 Rive invocations: 2 inspect, 1 failed headless invocation, 3 headless build/capture sessions. Final inspect: problems []; final two capture sessions: zero build errors/warnings and zero command errors.
- 3 supplementary Python image-check attempts (2 successful, 1 failed).
- 5 image-view attempts (4 successful, 1 failed).
- The 3 completed capture sessions issued 73 screenshot commands (15 + 15 + 43), 31 successful data dumps and 6 failed data dumps. Overwritten initial screenshots are counted; 58 distinct PNGs remain. Help/docs/schema/create, source generation, file listing, size counting, and git bookkeeping are excluded from validation runs.
Errors seen: 9 total occurrences, all resolved or bypassed:
- 1 CLI usage failure: space-separated `--commands commands.txt` interpreted commands.txt as a project directory: "no Rive project .../commands.txt (no rive.yaml)". Changed to `--commands=commands.txt`.
- 6 command errors: "data-dump: cannot write to stdout, which carries the acknowledgements; name a file". Changed dumps to build/*.json.
- 1 supplementary image-sheet attempt: ModuleNotFoundError, no module named PIL. Used a temporary standard-library PNG decoder instead.
- 1 image viewer failure: unable to locate /tmp/rive-sync-sheet.png, because the preceding sheet creation failed. Viewed four individual screenshots instead.
- Non-error renderer notice: no interlock mode supports this frame; renderer used depthStencil with 4x MSAA.
Source size: 911 lines, 49,744 characters: scene.rml 781 / 42,388; gen_scene.py 130 / 7,356. Counts include whitespace, comments, and final newlines; exclude YAML, commands, report, screenshots, and temporary checking helpers.

Brief items met: 5/6 fully met (1, 2, 3, 4, 6).
1. MET. Boolean syncing drives twelve 100ms states; each writes phase at entry. Rotation uses twelve hold segments. verification.txt samples 25 poses at 100ms intervals: phase values 0, 1/12, ... 11/12, 0, repeated twice (float readback within 3e-8). All 13 PNG pairs separated by 1.2s were pixel-identical. Symmetry makes half-turns look alike; phase readback independently establishes a full turn, rather than inferring it from pixels alone. Initial 50ms hold is unchanged, later tick changes visibly.
2. MET for the tested 60fps headless clock. Exit-time transitions wait until the current 100ms state ends; check then follows native elastic easeOut, amplitude 1, period .4 over 36 frames / .6s. stop-immediate.png and stop-wait.png have no accent pixels; stop-pop.png does. The stopped arrows retain their angle. In commands.txt the early overshoot accent bounds are (63,78)-(176,164), versus final (75,87)-(164,154); later oscillation is smaller. Final scale is 1. Arbitrary host frame jitter and rapid toggling were not exhaustively tested.
3. MET. Exactly one 24-frame Peek timeline controls both scale axes, with linear 1 to 1.1 keys. Pointer enter/exit writes +1/-1 to its NestedSimpleAnimation speed. Halfway enter then leave gives ink bounds (35,16)-(204,223), then (37,18)-(202,221), then original bounds (39,21)-(200,218) at that phase. This reverses the same timeline from its current time. Full enter, full leave, and second full enter also work; hover-full and hover-again PNGs are identical.
4. MET. Number phase directly scrubs NestedRemapAnimation time. Scrub captures test 0, .04, .082, .084, .25, .5, .75, 1. Values below 1/12 match zero exactly; .084 differs; 1 matches zero by whole-turn periodicity. Scrubbing also works after completion. The check stays visible after completion until another sync cycle starts.
5. PARTIAL, excluded from fully-met count. Host-supplied reducedMotion boolean bypasses all tick states and selects a one-key check pose. reduced-start.png equals reduced-still.png after 1.2s; reduced-check.png shows the final-size check on the first advanced frame, without overshoot. There is no OS preference detection or host adapter in this deliverable. The embedding application must set reducedMotion; automatic OS-driven behaviour is therefore unverified/unimplemented.
6. MET for initial rest. 00-rest.png shows arrows only, correct ink, no accent pixels; VM defaults syncing=false and phase=0. Both artboards are 240x240, centred at (120,120). Arc stroke and check stroke are 18px, radius 72px, and arrowhead arms 24px. Colour and source coordinates were checked; four PNGs were viewed individually.

Items not met or approximated, and why:
- Reduced-motion OS integration as above. No host wrapper is committed because only the Rive project artifacts were requested/allowed.
- Circular arcs use conventional cubic approximations, two 75-degree cubic spans per arc. They are not mathematically exact circles between vertices; geometric approximation error was not measured. Chevron orientation/size is an interpretation of the brief's small two-unit arrowhead.
- phase is also the internal playback cursor and changes while syncing. External writes to phase during syncing are not blocked. Restarting sync begins at phase zero. The brief only requests scrubbing while not syncing.
- Initial rest hides the check; completed rest preserves it. No automatic dismissal was specified. This is an explicit interpretation of the otherwise conflicting rest/completion descriptions.
- Headless PNGs have the CLI's dark background; ink remains the required #141413. No browser, OS accessibility, or deployed runtime checks were performed.

What was hardest; what the docs or diagnostics got wrong or left out:
- Finishing a discrete step while preserving a freely scrubbable stopped angle needed twelve timing states, rather than a simple spin loop. State-entry ListenerViewModelChange actions were discoverable through schema inheritance/flags, but not explained in the state-machine topic's action examples. inspect and capture confirmed they work.
- NestedRemapAnimation schema calls time seconds; the format topic correctly says it is normalized duration. Used normalized values.
- CLI help's optional commands argument was easy to misread; the equals spelling works. Commands mode rejects stdout dumps even though standalone dumps support stdout.
- A generator keeps repeated conditions/poses maintainable, but the resulting markup is verbose. Native negative-speed nested playback made actual hover reversal straightforward.

Reproduce from sync/: `~/.rive/bin/rive . --commands=commands.txt` and `~/.rive/bin/rive . --commands=verification.txt`; inspect with `~/.rive/bin/rive inspect . --summary`. Commands write transient JSON data into build/ for checking; those dumps and logs are deliberately not committed. No .riv file was read, opened, or converted. No account commands, interactive preview, publish, push, PR, or merge was used. Generated AGENTS.md, CLAUDE.md and .gitignore were removed before commit; no Rive documentation text is committed. Only the allowlisted deliverables are staged; root WORKLOG is unchanged to respect that restriction.

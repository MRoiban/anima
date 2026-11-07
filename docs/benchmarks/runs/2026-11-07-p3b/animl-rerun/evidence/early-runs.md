# Early runs (terminal observations, before the saved verification harness)

First command: complete read of the benchmark BRIEF.md, at approximately
2026-11-07 12:03:32 UTC. Deadline: 12:48:32 UTC.

- CLI help exited 2: `Anima CLI dependencies are missing; run npm ci at the repo root.`
- Ran the authorized `npm ci` once. It installed 153 packages and reported 10 moderate vulnerabilities and an esbuild install-script warning. No audit fix was attempted.
- First generator invocation failed with Python `KeyError: 'D'` because my handwritten bitmap alphabet omitted D. The immediately following validate invocation exited 2 with `no such file: docs/benchmarks/runs/2026-11-07-p3b/animl-rerun/settings.animl`. Added D to my generator.
- Second validate invocation passed with zero diagnostics.
- First sample invocation passed (exit 0), but exposed that tab arrows moved focus without selecting the new tab. Its subsequent actions on the hidden slider and switch silently had no effect. `--all` also emitted all vector path strings and was too verbose for practical terminal inspection.
- Second sample invocation proved semantic tab taps and the transition actions worked; three snapshots stayed on Sound as expected.
- Added explicit focus listeners selecting each tab. Third sample invocation passed: ArrowRight selected Sound, volume increase gave 45 / width 13.5, and mute tap gave true / knob translation 3.

Those are 5 early validate/sample invocations (1 missing-file failure, 4 successes).
The saved `runs.json` records the later harness runs. It does not include these early runs.
No repository implementation, tests, specs, examples, module files, other benchmark runs,
WORKLOG.md or git history were read. Format learning used CLI help/docs/schema only.

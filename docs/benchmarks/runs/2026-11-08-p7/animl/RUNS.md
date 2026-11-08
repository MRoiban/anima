First command: 2026-11-08T12:15:08Z (`date` and brief read).
Dependencies were absent; the first CLI `--help` exited 2 with “Anima CLI dependencies are missing; run npm ci at the repo root.” Ran npm ci once. It succeeded, reporting 10 moderate audit vulnerabilities (installation warnings, not scene diagnostics).

All commands used `node packages/cli/src/main.ts` from the worktree root. Scene commands used `--font AnimaTest=fixtures/fonts/anima-test.ttf`. All paths below are relative to this folder.

| Run | Command                                                                       | Result / evidence                                                                                   |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | validate reflow.animl                                                         | validate-01.txt; unknown-attribute ×2 (`set` on `on`)                                               |
| 2   | validate reflow.animl                                                         | validate-02.txt; bad-name ×1                                                                        |
| 3   | validate reflow.animl                                                         | validate-03.txt; clean                                                                              |
| 4   | sample, advance 0; snapshot --all                                             | sample-01.jsonl; clean                                                                              |
| 5   | sample -s exercise.txt (initial `data set` version)                           | sample-02.jsonl, sample-02-errors.txt; script-usage ×1: Cannot redefine property: busy              |
| 6   | build --out-dir export                                                        | build-01.txt; clean                                                                                 |
| 7   | sample, advance 0; advance 0; snapshot --all                                  | sample-03.jsonl; clean                                                                              |
| 8   | sample, advance 0; set $buttonLabel "Save changes"; advance 0; snapshot --all | sample-04.jsonl; clean                                                                              |
| 9   | sample -s exercise.txt (set version, incorrect numeric expectations)          | sample-05.jsonl, sample-05-errors.txt; script-expect ×13; script retained as exercise-05-failed.txt |
| 10  | sample -s exercise.txt (correct space-glyph advances)                         | sample-06.jsonl; clean; all 19 assertions pass                                                      |
| 11  | render, default                                                               | render-01.txt, rest.svg; clean                                                                      |
| 12  | render, label change then advance 0 and 0.15                                  | render-02.txt, midpoint.svg; clean                                                                  |
| 13  | render, label change then advance 0 and 0.3                                   | render-03.txt, grown.svg; clean                                                                     |
| 14  | render, long chip1 and hidden chip3                                           | render-04.txt, hidden.svg; clean                                                                    |
| 15  | validate reflow.animl, final                                                  | validate-04.txt; clean                                                                              |

No check, session or other build/render/sample/validate invocation was made. Help/docs/schema queries are excluded from the 15 execution runs. They were the only format-learning sources; no repository implementation/spec/example/test source was read. The exported HTML produced by build was inspected as tool output.

Browser helper runs (separate from the 15 CLI runs):

1. Launch failed: executable did not exist at `.../chrome-headless-shell-linux64/headless_shell`. Correct name is `chrome-headless-shell`.
2. Evaluation of `icon.data` threw `Cannot redefine property: busy`. A subsequent Python attempt to read the unwritten host-01.json raised FileNotFoundError once.
3. Collected host-01.json without evaluating icon.data: recorded one page error, `Cannot redefine property: busy`, caused by auto-bind.
4. Removed auto-bind and browser data controls. Verified contain and two responsive host sizes: host-02.json and host-02.txt, 10 assertions passed, no browser errors.
5. Replaced embedded generated JSON in host.html with loading export/reflow.ani, then reran: host-02.json and host-03.txt, 10 assertions passed, no browser errors.

Thus `Cannot redefine property: busy` was observed three times: once through CLI script-usage and twice in the browser. It is not an additional fourth error on top of script-usage. The final browser page controls only host fit/size. All data edits, animations and hide/show proof are in the CLI script. No page helper computes widths, interpolates boxes, or removes chips.

`geometry.csv` is a projection of sample-06.jsonl; the latter retains full target/drawn positions and sizes for all participating nodes. `host-02.json` retains SVG boxes, host-space rectangles, and matrices at all three host configurations. The browser uses the original fixture font through CSS; no font file was copied or added. Browser fractional font measurement differs slightly from CLI OpenType measurement, so cross-backend exact text-width equality is not claimed.

6. After formatting authored HTML/JS, reran the same browser helper: host-02.json and host-04.txt; 10 assertions passed, no browser errors. No CLI scene changes followed final validation.

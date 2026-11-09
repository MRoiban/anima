# Open issues #23–#35: shared brief

Downstream reports from Golem (React controls on Anima) and anima-kit (https://anima-kit.mc2.onl).
Read each issue in full with `gh issue view <n> --comments` before starting. Integration branch:
`issues-23-35` (from main + changelog). Each ticket branch is merged there by the orchestrator, then
one PR to main closes the issues.

## Every issue, in this order

1. **Reproduce.** Write the smallest test that shows the bug, or the missing capability, against the
   current code: a unit test, a conformance case, or a browser test (`playwright-core` with the
   cached Chromium/Firefox, as in `modules/assetio/test/web/reject.test.ts`). Run it and confirm
   that it **fails** for the reason in the issue.
2. **Capture proof of the bug.** Save the failing run's output (trimmed to the relevant lines) to
   `design/issues/proof/<n>-before.txt`. For visual bugs, also save a screenshot
   `design/issues/proof/<n>-before.png` (small: crop to the icon, ≤ 50 KB) and the measured numbers
   (`getBoundingClientRect`, computed colours, events received).
3. **Fix it** with the smallest change that meets the definition of done below. Update the spec
   (`spec/SPEC.md`), `docs/WEB.md` or `docs/AUTHORING.md` in the same commit when behaviour
   changes.
4. **Capture proof of the fix.** Save the same test passing to `design/issues/proof/<n>-after.txt`,
   plus `<n>-after.png` and numbers for visual bugs. The test stays in the suite as the regression
   test.
5. If you find the issue is already fixed on this branch, the test is still required: say so,
   cite the commit (`git log -S`), and save the passing run as `<n>-after.txt` with a note. In that
   case `<n>-before.txt` is a run at the parent of that fix commit (in a temporary worktree under
   `/tmp/anima-<n>-*`, removed afterwards), or a note that explains why that run isn't possible.

Write a short report, `design/issues/<TICKET>-REPORT.md`. Its header gives:
status, issues covered, verify result, sizes before and after, deviations, open problems. Then
one section per issue: repro, cause, fix, proof files, and any decision you made ("decided, owner
may revisit"). Don't edit `WORKLOG.md`.

## Rules (from AGENTS.md, all still apply)

- Run `npm ci` first. A fresh worktree has no `node_modules`; never symlink one.
- Test with `npm run test:scope -- <targets>` (module names, `web`, `core`, `cli`, `conformance`,
  `oracle`, `changed`). Before you finish, run
  `npm run test:scope -- changed`, `npm run lint`, `npm run format:check` and
  `node tools/size.ts` once each, and check the **exit code** of size, not just its output.
- After a manifest edit: `node tools/modules.ts`, then `node tools/build-web.ts`. After spec or
  conformance edits: `npm run gen`, `node tools/build-animl.ts --check`, `node tools/parity.ts --check`.
  The corpus count in `packages/markup/test/corpus.test.ts` equals
  `ls spec/conformance/*/case.ani | wc -l`.
- Size gates (min+gzip, owner ceilings, never raise them): core+web ≤ 24,576 B (now 22,564);
  per module entry ≤ 8,192 B; app-UI set ≤ 131,072 B; runtime sum ≤ 163,840 B. Full entries
  can't grow without a split: markup-libraries, markup-hooks, layout, fonts, fonts-info,
  host-fit. Put new AniML spellings in your module's own `markup-*` entry.
- Per-frame cost guard: ≤ 3 %. Don't add work to `Player.step` or the draw path on scenes that
  don't use the feature.
- Determinism: a change to `Player.step` output needs a conformance case.
- Diagnostics: each one has a code, a JSON pointer, a message and, where possible, a hint, and a test.
- No runtime dependencies in `packages/core` or `packages/web`. Never `--no-verify`; if prettier
  fails, `npx prettier --write <files>`.
- Don't copy Rive source or docs; don't read `.riv` files; no third-party font files (use
  `fixtures/fonts/anima-test.ttf`).
- New browser test files need an explicit 30 s timeout. Text pixel comparisons load the fixture
  font and poll (`expect.poll`), never fixed frame waits.
- Under shared machine load, rerun a failing test file alone before calling it a bug.
- Commit on your ticket branch, in small commits. Don't push to `main`, don't open a PR, and don't
  touch files outside your ticket's list, except generated wiring and your proof and report files. If you need a
  change in someone else's file, write it under "Requests" in your report instead.

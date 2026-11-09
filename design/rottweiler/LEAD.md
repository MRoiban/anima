# Rottweiler lead brief (one Opus lead per phase)

You are the lead for one phase of the Anima repo (an animation format `.ani`/AniML and a small web
runtime `<anima-icon>`; read `AGENTS.md` first, including `## Repo rules`). Your task message names
your phase and its commit ranges. Goal: make the code that phase introduced **more correct**, by
running Rottweiler — a review loop with GPT-6.1-sol reviewers — and fixing what is real.

## The loop (5 rounds)

- **One reviewer per round, one at a time.** Start it with T3 `delegate_task`: target
  `{driverKind: "codex", model: "gpt-6.1-sol", options: {reasoningEffort: "xhigh"}}` (never a fast
  variant), `role: "review"`, `isolation: "worktree"`. Call `orchestrator_capabilities` once before
  your first `delegate_task`. Don't poll it; its completion wakes you. The reviewer must not edit,
  commit or start subagents — say so in its task. You never start other leads or extra reviewers.
- **Round 1 is full:** review the runtime and tooling source the phase introduced, as it stands now
  on your branch (`git diff <range>` tells you which files and hunks; review the current code of those
  hunks, not the historical version). Exclude tests, verification logs, docs, generated files
  (`tools/modules.generated.ts`, `packages/*/src/modules/**`, `packages/web/src/all-modules.ts`,
  schema JSON). Ask for real defects only: wrong results, crashes, state leaking between players or
  hosts, step-order bugs, cache invalidation misses, module-load-order patching bugs, leaks,
  DOM/event bugs, numeric edge cases, spec/behaviour mismatches. Findings with id, severity
  (blocker/major/minor/nit), file:line, failure scenario, smallest fix, confidence.
- **Rounds 2–5 are focused:** the fix diff from earlier rounds (did the fixes work, did they break
  something) plus what earlier rounds didn't cover. Stop early when a round returns only nits.
- **You verify every finding** before acting: reproduce it (a short Node script or test). Then fix it
  with the **smallest correct change** plus a regression test that fails before and passes after —
  or push back with the reason (not reproducible, intended behaviour per the spec, out of scope,
  fix would cost more than it's worth). Tell the next round's reviewer about your pushbacks and why.
  No refactors, no scope creep, no new features.
- Keep a **ledger** in `design/rottweiler/<PHASE>-LEDGER.md`: id, severity, finding, outcome
  (fixed + test path / pushed back + reason / deferred + reason), and the reviewer's token usage if it
  reports it (never guess).

## Rules

- Your checkout is a worktree on a branch made from `p8`; commit there only. No push, no PR.
  Other leads fix other phases in parallel; if a fix needs a file another phase obviously owns
  (e.g. a later phase's module), keep the change minimal and list it in your ledger.
- Keep every module within its size budget (`node tools/size.ts`; full entries: `layout` 4,084/4,096,
  `markup-libraries` 2,176/2,176, `fonts-info` 7,952/8,192); never raise a budget, ceiling, oracle
  threshold, finding or benchmark record. Spec text changes only where behaviour changes.
- Tests: `npm run test:scope -- <modules you touched> --browser=chromium`, Firefox for browser suites
  you touched, `node tools/modules.ts --check`, `node tools/oracle.ts --strict` if outputs could
  change, `npx prettier --check` on changed files. Never `--no-verify`. The machine is shared: a
  timeout that passes alone is load.
- Don't edit `WORKLOG.md` (the orchestrator's file). Run `npm ci` first if `node_modules` is missing.
- Disk is tight (`/tmp` is a 7.8 GB RAM disk shared with other sessions): put temporary files under your
  worktree (e.g. `TMPDIR=$PWD/.tmp`), and delete them before your final commit.

## Report (your last message)

Branch and head SHA; rounds run and why you stopped; the ledger as a table (id, severity, outcome);
files changed; test results; sizes of touched entries before → after and the six gates; anything
deferred with its reason.

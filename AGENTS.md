# AGENTS

Anima is an open animation format (`.ani`) and a small web runtime for interactive icons, designed
to be written by agents and to fit Glyphy-made icon sets.

Start here, in this order:

1. `docs/PLAN.md` — milestones, acceptance criteria, ground rules. Work the next unchecked item.
2. `spec/SPEC.md` — the normative format. Behaviour not in the spec is not done; change the spec
   in the same commit as the code.
3. `docs/ARCHITECTURE.md` — packages and their responsibilities.
4. `examples/bell.ani` — the reference document; `fixtures/bell/` — what it must reproduce.
5. `docs/research/` — notes on Rive's runtime (format, animation/state machines, web runtime) and
   on Glyphy. Read them for ideas and pitfalls; cite them in decisions.

Rules:

- Do not copy Rive source code or Rive's CLI documentation text, and do not read or convert `.riv`
  files. Rive is inspiration only.
- Keep `packages/core` and `packages/web` free of runtime dependencies.
- Every diagnostic has a code, a JSON pointer, a message and, where possible, a hint, and a test.
- Determinism: anything that changes `Player.step` output needs a conformance case.
- After each milestone: tests green, PLAN checkboxes updated, an entry in `docs/LOG.md`, a commit on a
  milestone branch, a PR to `main`.
- Ask the user before making the repo public, publishing packages, or changing the Glyphy repo
  beyond a draft PR.

Local tooling: Node 24 (`node`, `npm`), Python 3.13, `gh` (signed in as MRoiban). Playwright's
Chromium headless shell is cached at `~/.cache/ms-playwright/chromium_headless_shell-1248/`; use
`playwright-core` with `executablePath` pointing at it rather than downloading browsers.

## Testing

During development run `npm run test:scope -- <target…>` for the packages or modules you touch:
`core`, `markup`, `web`, `cli`, `playground`, module names such as `paint`, `composite`, `bind`,
`assets`, `components`, `surface`, or `conformance`, `oracle`, `changed`.
The command prints selected files. Module targets include matching tests across packages and their
conformance cases, plus shared markup integration/registry tests. Browser tests run only when selected; use `--no-browser` to omit them or
`--browser=chromium|firefox` for one engine. `changed` compares the merge-base with `main` through
HEAD plus staged, unstaged and untracked files; override with `--base=<ref>`. Shared core/web changes
select the whole package; shared tooling/config changes conservatively select all packages and tools
(including oracle).

CI runs the complete `npm run check` on every PR and push, including Chromium and Firefox, oracle,
size budgets, generated artifacts and the perf report. Merge only when CI is green. Before a phase
PR, do one full local run only for what CI cannot run; do not repeatedly run the full suite while coding.

## Work log
`WORKLOG.md` (repo root) holds task state outside your context window.
- **On start and after compaction:** read `WORKLOG.md` and `git log --oneline -15` before acting.
- **Update at checkpoints:** after a milestone, before a risky or long step, when the plan changes, and before you stop. Don't let the context run out with unlogged work.
- **Now** (top): rewrite it to stay at 10 lines or fewer: goal, verified state, next step, don'ts.
- **Log** (below): append only, one line per entry: `- YYYY-MM-DD HH:MM [who]: did X → result (evidence: command/number/commit)`. Log failures and dead ends too. Tag anything unchecked `(unverified)`.
- Facts, not narration. Commit the log with the code it describes.
- Past ~200 lines: condense the oldest half into a 5-line summary at the top of Log.

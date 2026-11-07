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

Formatting: `npm install` sets `core.hooksPath` to `.githooks`, whose pre-commit, pre-merge-commit and
pre-push hooks run `prettier --check` on the files you change. Never commit with `--no-verify`; if a hook
fails, run `npx prettier --write <files>` and commit again. After a sed or script edit, run
`npx prettier --check <files>` before committing. (A formatting slip turned CI red on PR #11 and on p3b.)

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

## Adding a module

Add only files under `modules/<name>/`: a `manifest.ts` plus its core/SVG, markup, web and
`test/<package>/` files as applicable. Follow `spec/MODULES.md` §3 and an existing manifest for
`after`, byte and markup-hook budgets, test globs, conformance prefixes, docs and public adapters.
Keep runtime code within its package responsibility: core stays pure and DOM-free; web owns DOM.
Run `node tools/modules.ts` and commit its generated adapters/tables/package exports with the module.
Do not edit generated files or shared module lists. `node tools/modules.ts --check` rejects stale
wiring. Run `npm run test:scope -- <name>` while developing; include shared markup integration tests
in the manifest where registry changes affect them. Module scopes select their explicitly owned
browser suites, without following references to other modules.

## Adding a capability

Start coder briefs with `node tools/new-capability.ts <parity-row-id> --dry-run`, then run it
without `--dry-run`. The module defaults to the inventory's `anima.module`; use `--module motion`
(or another name) when the inventory's broad bucket needs a dedicated module. Completed rows are
rejected. Repeated runs preserve coder edits and leave parity status unchanged.

The tool adds module registration/SVG/markup/web skeletons and a size budget when needed, a spec
subsection, inert registry entry template, diagnostic `.todo` test and invalid-fixture folder,
conformance and oracle probes, an AniML/JSON example pair, parity mappings and generated wiring.
Fill every TODO, compose the registry entries into the module, review `after`/budget, and verify
CLI/schema support. Existing module conformance prefixes are extended automatically.

A probe directory with `todo.json` containing `{"status":"todo","reason":"..."}` is pending:
conformance and oracle tests report it as TODO, never passing. AniML build/corpus checks omit pending
conformance sources. Replace the probe and independent expectations, rebuild `.ani`, then remove
the marker. For oracles, capture references and add a fully specified entry to `tests/oracle/cases.json`;
a marked case in that completed manifest is an error. No-faithful-counterpart rows get a skip note.
Run `npm run test:scope -- <module> conformance oracle` while implementing; a scaffold passing checks
does not meet the capability definition of done in PLAN.

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
- **Reality wins:** if `Now` or a Gotcha contradicts the repo or test output, trust the repo; fix the log and record the correction.
- **Update at checkpoints:** after a milestone, before a risky or long step, when the plan changes, and before you stop. Don't let the context run out with unlogged work.
- **Now** (top): keep it short; goal, verified state, next step, don'ts. Re-read it right before rewriting it, in case another agent changed it.
- **Gotchas:** when you learn something a future session would get wrong without being told (a trap, a non-obvious constraint, a fix that took several tries), add one line: `- <rule> — <evidence>`. Edit or delete it if it turns out wrong. Never condense this section. If a gotcha holds for anyone working in this repo, move it to a `## Repo rules` section in `AGENTS.md`.
- **Log** (below): append only, one line per entry: `- YYYY-MM-DD HH:MM [who]: did X → result (evidence: command/number/commit/...)`. Log failures and dead ends too. Tag anything unchecked `(unverified)`.
- Facts, not narration. Commit the log with the code it describes.
- Past ~200 lines: move lasting lessons to Gotchas, then condense the oldest half of Log into a 5-line summary at the top of Log.
- Adapt these rules to fit your work and tasks.

## Repo rules
- Test timeouts while several agents share the machine usually pass when rerun alone; rerun the failing file isolated before calling it a bug, and report both runs.
- Timings under shared load are not perf evidence; say so rather than claiming the ≤ 3 % guard.
- After editing a manifest, run `node tools/build-web.ts`: browser demo tests read its cache and fail with "run build-web" when it is stale.
- `node tools/size.ts` can take over 2 minutes under load; give it a long timeout.
- No module entry may exceed 8,192 B. `markup` (7,341 B) and `surface` (7,660 B) have under 1 KB left, and `text` and `markup-libraries` are full: new AniML spellings go into your module's own `markup-*` entry, and growth in a full entry needs a split into an optional entry first (check with `node tools/size.ts`).
- A fresh worktree has no `node_modules`: run `npm ci` before tests, `tools/size.ts` or committing (the format hook skips `prettier` with a warning without it).
- Don't edit sources while `node tools/size.ts` or a test scope is running; the run mixes versions and is invalid. Measure and test from a frozen tree.
- Committed verification logs must not end with blank lines (`git diff --cached --check` fails); trim them before committing.
- Module registry feature names can't contain hyphens (feature `textinput`, entry and folder `text-input`).
- New browser test files need an explicit timeout (adjacent suites use 30 s); Vitest's 5 s default fails under load.
- Optional loader hooks chain: a wrapper around `Icon.loadAssets` must return the previous loader's per-player initializer, or asset catalogs are lost when the modules load in the other order.
- AniML library files (imported, not scenes) live in `examples/lib/`; under `modules/*/examples/` the corpus test treats them as scenes.
- `docs/parity/inventory.json` is written with 2-space indent and unescaped Unicode (`json.dumps(..., indent=2, ensure_ascii=False)`).
- `tests/oracle/generate.py` rewrites `tests/oracle/cases.json` with different formatting; restore it unless thresholds really change. Its Rive scenes encode Anima's spec geometry (e.g. rounded corners as cubic handles), so a spec geometry change means re-authoring the scene there and recapturing, never a threshold change.
- Browser tests that render text must load the declared font (serve fixture files to the page) and wait for the redraw (two animation frames) before comparing pixels; a platform fallback font or an early screenshot passes locally and fails on CI.
- The rect-corners oracle passes with a thin margin (0.1198 % vs 0.12 %): a paint or anti-aliasing change may tip it.

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

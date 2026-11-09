# Work log

Orchestrator memory. Ticket agents keep their notes in their own report files
(`modules/<module>/<TICKET>-REPORT.md`, `tests/oracle/<TICKET>-REPORT.md`) and don't edit this file.
History is in git, not here: `git log`, `docs/LOG.md` (one entry per phase), `docs/PLAN.md`,
`docs/parity/*-closure.md`, `docs/benchmarks/agent-native.md`. The timestamped log this file used to
carry (2026-11-06 → 2026-11-08) is at `git show 39ab6837:WORKLOG.md`.

## Now

- Goal: a smaller, agent-native Rive for animated web UI. Next phase: P8 rigging (bones,
  constraints, IK, skinning, meshes, vertex weights; heavy modules on the canvas backend; path
  measurement internal) plus the `a11y.tree-bounds` carry-over.
- Per-phase Rottweiler review (P1–P7, ~190 fixes) merged in PR #37 (2ce1ef3). Ledgers in
  `design/rottweiler/`. Branch `p8-rigging` from main.
- Waiting on the owner (raised in PR #37): P6 R2-04 non-square viewBox draws offset in the SVG
  host (mapping decision for SVG + canvas; recommended: a non-square viewBox fills the host); P4
  R4-02 hit/focus order vs `drawOrder`; `a11y.tree-bounds` maybe-later.
- Deferred review items are listed in PR #37 (entry splits for markup-libraries/fonts, construction
  context, gamepad connect signal, knockout trims, external `$parent` checks, fonts.assign names).
- Next: P8 design (`design/p8/DESIGN.md`) and briefs.
- Gates now: core+web 22,564; largest scene 57,505; app-UI 107,630; runtime sum 133,491;
  authoring 15,006; Rive-class 152,563.

## Owner

- Still to ask before doing: going public, publishing packages (npm scope not chosen), other Glyphy
  changes.
- Decided by me, owner may revisit (details in `docs/LOG.md` P6 entry and the designs):
  - Downstream bugs: the overlay passes pointer input to the drawing; events bubble (Anima only
    prevents defaults it consumes); the host sizes to the viewBox aspect; imported components keep
    their names (`alias:name` on clashes); rect corners are circular (rect-corners oracle scene
    re-authored, no threshold change); one compile per document, root chosen per host.
  - P6: the CLI renders text with its own OpenType reader; font glue in `fonts`; bidi kept (150 B);
    `<text>` with width and height is fixed-size; animation syntax in optional `markup-animation`;
    `contains`/`lower` in bind; 18 open P6 rows moved to P7.
  - Size sets: app-UI includes text, text-overflow, text-effects, fonts, fonts-text, a11y-text,
    host-fit (and layout, layout-reflow when they land); data-artboard, text-hit, text-canvas stay
    optional.
  - P7: layout is our own single-line flexbox subset (no wrap, no Rive engine port); conditions read
    the previous step's boxes; module budgets fonts-text 768 → 896 and text-input 4,096 → 4,544 by the
    P3c reset rule after the combined review fixes (2026-11-09); a retargeted reflow continues from the drawn box (CSS-transition
    style) — closed as an intentional difference from Rive (start/middle/end match natively);
    P7-6 closed 11 text rows as documented differences (continuous fitting, typographic ellipsis,
    effective trim, native-field semantics).
  - Test deadlines raised for the larger corpus: module-order 90 s, scaffolder 120 s.

## Gotchas

- Merging a ticket branch: regenerate (`node tools/modules.ts`, `npm run gen`,
  `node tools/build-animl.ts --check`, `node tools/parity.ts --check`, `node tools/build-web.ts`);
  the corpus count in `packages/markup/test/corpus.test.ts` is `ls spec/conformance/*/case.ani | wc -l`;
  oracle `cases.json`/`metrics.json` conflicts union by name; appended SPEC/LOG sections keep both.
  Agents briefed before this change still append to WORKLOG: on conflict keep ours.
- Remove each agent worktree after merging (`git worktree remove --force`, delete the branch): kept
  worktrees once filled the root disk (88 worktrees, 12 GB).
- Agents' failure counts are mostly load timeouts: rerun the failing files alone before acting.
- After the last merge of a phase, run `npm run test:scope -- changed --no-browser` once before the
  PR: tickets merged in sequence break each other's new tests (P6-12 × P6-13 turned CI red).
- Perf A/B: in-process against a detached main worktree (`/data/t3/projects/anima-perfbase`), under
  `taskset -c 5`, alternating, minimums. For a regression, bisect merges with an in-process compile
  loop, then `node --cpu-prof` both sides (P6 bell compile +5 % was a per-character `matchAll`).
- Agents don't set oracle budgets: they report raw max/over and leave `todo.json`; I add the case to
  `tests/oracle/cases.json` from the measured anti-aliasing numbers.
- Parity lint: `IN_PROGRESS` in `tools/parity.ts` names the phase being worked on (now P7); add a
  finished phase to `FINISHED`.
- An interrupted ticket resumes by messaging its thread (`t3_thread_send`); its worktree survives.
- Budget headroom: markup-libraries 2,176/2,176 (full), markup-hooks ~4,534/4,544, data-artboard
  1,013/1,024, host-fit 733/768 — growth there needs a split first.
- Disk fills during review waves: every reviewer gets a ~245 MB worktree and agents leave
  `/tmp/anima-*` (tmpfs, 7.8 GB). After each lead/merge, remove only worktrees on an explicit list
  of finished branches — never by "clean + idle + name matches": a lead waiting on its reviewer is
  clean and idle (2026-11-09 I removed the P2 and P6 leads' worktrees that way and recreated them from
  their tips b5214b08 / 342e586e at the same paths); and delete `/tmp/anima-*` older than 3 h — on 2026-11-08 `/tmp` hit 100 %
  and `/` 97 %. Abandoned P4-era worktree diffs were saved to `/data/t3/projects/anima-worktree-backups/`.
- Never symlink the main checkout's `node_modules` into a worktree for tests: its workspace links
  resolve `@anima-format/*` to the main checkout's packages, so tests run main's code (P6 lead saw 54
  false failures); run `npm ci` in the worktree. (Symlinks are fine for the perf A/B, which imports
  by absolute path.)
- Before a phase PR also run `npm run lint` and `npm run format:check` on the merged tree: leads'
  scoped checks missed a lint error (P1's XML control-character regex) and CI caught it on PR #37.
- Before a PR, check `node tools/size.ts`'s exit code, not just the gate table: per-entry overruns
  only show as "— over" lines (PR #37: fonts-text and text-input crossed after the merges).
- Repo-wide rules are in `AGENTS.md` `## Repo rules`.
- 2026-11-08 15:20 [orch]: PR #36 CI red twice on modules/text/test/web/live-runs.test.ts (Chromium live vs literal control screenshots): a frame wait and a 3 s poll didn't help — the mismatch persists on CI only (same Chromium 1248, source-hashed bundle cache; passes 5/5 locally); pushed diagnostics (renderer, step, both SVGs, inked canvas pixels) to read from the next CI log (unverified cause)

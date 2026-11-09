# Work log

Orchestrator memory. Ticket agents keep their notes in their own report files
(`modules/<module>/<TICKET>-REPORT.md`, `tests/oracle/<TICKET>-REPORT.md`) and don't edit this file.
History is in git, not here: `git log`, `docs/LOG.md` (one entry per phase), `docs/PLAN.md`,
`docs/parity/*-closure.md`, `docs/benchmarks/agent-native.md`. The timestamped log this file used to
carry (2026-11-06 → 2026-11-08) is at `git show 39ab6837:WORKLOG.md`.

## Now

- Goal: a smaller, agent-native Rive for animated web UI. Phase: **P8 rigging** on `p8-rigging`
  (25 `rig` rows: bones, constraints, IK, skinning, meshes, weights, joystick, follow-path; heavy
  modules on the canvas backend; path measurement internal), plus carry-overs: `a11y.tree-bounds`
  and P4 R4-02 (hit and pointer-focus order follow composite `drawOrder`), and pre-player `toggle()`
  queued like `set`/`fire`.
- Main is c2b870ae: PR #37 (per-phase Rottweiler, ~190 fixes, `docs/changelog/2026-11-09-rottweiler.md`)
  and PR #38 (issues #23–#35, proof in `design/issues/`) are merged; no open issues or PRs.
- P8 design merged (`design/p8/`: DESIGN, BENCHMARK, tickets P8-1…9, DECISIONS D1–D35 + my answers
  and D36 `posepad` one word, D37 optional `posepad-handle` entry if `posepad` > 768 B, D38 bone
  parents: root, component root, group, bone), D39 zero rest scale is `bad-value`, D40 core point
  tuples (+16 B core+web), D41 budget resets (mesh 1,472, posepad 896, components 3,840), D42 no
  mesh oracle budgets before a diff analysis, D43 mesh budgets 70/0.40 and 100/0.45 (seams and edge
  only), D44 rig probes use rect art; unrotated 16/2/0, rotated 65/0.12. **14/26 rows done**
  (tree-bounds, 3 posepad, 2 mesh, 8 rig). Open: rig bone-chains, root-bones (`rig-bone-parent`
  order) and transform (origin gaps) in P8-1b; IK (P8-2, only a scaffold committed, 5f7ba667);
  path follow, skin, scroll; posepad handle. Codex limit until 23:30: patches `p8-1b-1`, `p8-2-1`;
  a scheduled task resumes both at 23:35. Size exits 0: core+web 22,803, Rive-class 163,987.
  Disk 3.5 GB free.
- Deferred review items (PR #37): entry splits for markup-libraries/fonts, construction context,
  gamepad connect signal, knockout trims, external `$parent` checks, fonts.assign names, sliced
  fixed-width strokes. Issue follow-ups: `colormix` `currentColor` defaults (needs a static-colour
  seam), `fill="mix(...)"` attribute spelling (needs a compiler colour-reader seam).
- Gates (main): core+web 22,782; largest scene 57,781; app-UI 107,899; runtime sum 135,579;
  authoring 15,017; Rive-class 155,805 (of 256,000).

## Owner

- Coders: **GPT-6.1 Terra** (`gpt-6.1-terra`) at **medium** effort, and **at most 2 concurrent subagents**
  (owner, 2026-11-09).
- Still to ask before doing: going public, publishing packages (npm scope not chosen), other Glyphy
  changes. Licence is MIT (owner, 2026-11-08).
- 2026-11-09 the owner handed me the open decisions ("I believe in your trust"). Decided, owner may
  revisit: P4 R4-02 — pointer hits and pointer focus follow the painted order (`drawOrder`), as one
  coordinated input + focus + composite change in P8; `a11y.tree-bounds` stays in P8.
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
  - Issues #23–#35 (2026-11-09): non-square viewBox → uniform scale, the host's long axis spans
    `grid` (square unchanged); pre-player `set`/`fire` queued FIFO; `icon.settle()` (bounded 60 s,
    events discarded); `part="svg"`/`part="canvas"`; keyboard semantic actions dispatch through the
    scheduled step (`icon.flush()` seam); disabled focus scopes stay semantic (no warning: focus
    budget); toolbar/grid roving in optional `a11y-navigation`; `corners` module split from paint
    (`paint|corners`); `colormix` module with `<colorMix>` child syntax and hex-only defaults;
    text-input blink/scroll in optional `text-input-extra`, `selectionTextColor` aliasing
    `selectedTextColor`, fields clip their drawing; `anima bundle --modules`; #31 was already fixed
    by bb989f1e.
  - Test deadlines raised for the larger corpus: module-order 90 s, scaffolder 120 s.

## Gotchas

- Merging a ticket branch: regenerate (`node tools/modules.ts`, `npm run gen`,
  `node tools/build-animl.ts --check`, `node tools/parity.ts --check`, `node tools/build-web.ts`);
  the corpus count in `packages/markup/test/corpus.test.ts` is `ls spec/conformance/*/case.ani | wc -l`;
  oracle `cases.json`/`metrics.json` conflicts union by name; appended SPEC/LOG sections keep both.
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
- Parity lint: `IN_PROGRESS` in `tools/parity.ts` names the phase being worked on (now P8); add a
  finished phase to `FINISHED`.
- An interrupted ticket resumes by messaging its thread (`t3_thread_send`); its worktree survives.
  A Codex usage limit fails every running coder (2026-11-09, all five of wave 1): save each
  worktree's uncommitted work first (`git add -A -N . && git diff HEAD > …/anima-worktree-backups/<branch>.patch && git reset -q`),
  then resume. Don't switch providers without asking the owner.
- Terra at medium effort stops early (P8-2 committed only the scaffold and reported "partial"; P8-1b
  stopped after the first analysis step). Briefs must list the steps in order and say that a
  scaffold or a first checkpoint is not a final state; resume with the remaining steps spelled out.
- Disk: `/` was 93 % (3.7 GB free) with five P8 worktrees; check `df -h /` before each wave and
  remove merged worktrees promptly.
- Budget headroom (2026-11-09): markup-libraries 2,174/2,176, components 3,453/3,456, a11y-dom
  2,154/2,176, markup-hooks 4,523/4,544, canvas 5,864/5,888, fonts 2,016/2,048, layout 4,057/4,096,
  fonts-info 8,100/8,192 — growth there needs a split first (P8 draws on canvas: plan for it).
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
- Ignored canvas test artifacts (`modules/canvas/test/web/artifacts/*-metrics.json`) fail
  `npm run format:check` locally; delete them before checking.

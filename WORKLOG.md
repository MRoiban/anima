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
- P7 merged (PR #36, c3b79b4). Branch `p8` from main. In scope 860/886 (97 %).
- Now (owner, 2026-11-08): per-phase Rottweiler review before P8 — one Opus 5.5 lead per phase
  (P1 = PRs #1–#7, P2 #8, P3 #9/#19/#20, P4 #10/#12–#16, P5 #11/#17, P6 #21, P7 #36), each running 5
  rounds with one GPT-6.1-sol reviewer at a time and fixing on its own branch from p8; brief
  `design/rottweiler/LEAD.md`, ledgers `design/rottweiler/<PHASE>-LEDGER.md`. Batches of 3 leads
  (machine load). Done: P5 (20 fixed, 6 deferred; 2c09c86), P7 (R1 7 + R2–R5 15 fixed, 2 deferred: R2-5 fonts
  faces → sent to P6 lead, R4-6 `$parent` check in external components; 1 pushed back; 0f2f92c). Done also: P3 (25 fixed, 2
  pushed back, 3 deferred; 698693e). Done also: P4 (30 fixed, 1 pushed back, 3
  deferred; merged with P3 input/machine overlap combined). Done also: P1 (44 + 2 partial fixed, 10
  pushed back, 2 deferred; e8d4436; hit testing combined with P4's ordered paints). Done also: P2 (15 fixed; ARIA merged with P1).
  Running: P6 lead; P7 round-1 fix coder (7 findings, ledger in my
  scratchpad: R1-1 nested crash, R1-2/R1-5 hit-test + a11y bounds ignore layout, R1-3 dynamic
  instance measure, R1-4 a11y cache, R1-6 data-artboard retention, R1-7 host-fit content box) →
  then the P7 lead from round 2. Queue: P3, P2, P1. I merge each lead's branch into p8, then one PR.
- Review follow-ups nobody owns yet (do before the review PR or list in it): asset loader on a page
  without a base URL rejects with an `Error`, not diagnostics, so `icon.ready` never settles (found by
  P3, P5 code); P3's round-5 fixes to the reduced-motion blend restore path had no further review;
  P7 R4-6 external component `$parent.x` unchecked (NaN); P6 R2-5 font faces after repeated
  `fonts.set` (sent to the P6 lead — check its ledger); P5 deferrals waiting on a `markup-libraries`
  split; P4 R3-03 re-registering base paint replaces the sampling backend (P5b code), R4-02 pointer
  focus and hit order ignore composite `drawOrder` (needs a joint input/focus/composite decision),
  R2-05 gamepad polling stops after a long detach (needs a host connect signal). P1: P2/P6 share
  `packages/web/src/index.ts` ARIA edits (expect a conflict); P1 R2-03 knockouts ignore stroke trims
  (needs bell fixture + canvas change). Decided (owner may revisit): add a loader limit on overall JSON
  nesting depth with a diagnostic (P1 R3-04/R4-08 root cause).
- After the review: P8 design (rigging).
- Gates at end of P7: core+web 21,165; largest scene 55,444; app-UI 104,592; runtime sum 130,133;
  authoring 14,899; Rive-class 148,870 (rigging counts here). Full: layout 4,084/4,096,
  markup-libraries 2,176/2,176, fonts-info 7,952/8,192 (heavy).
- Open: `modules/text/test/web/live-runs.test.ts` failed on CI twice (Chromium live vs control
  screenshots) then passed; diagnostics are in the test — if it fails again, read the CI log detail.
  Bell compile is at the ≤ 3 % guard (+2.9 % vs main before P7): consider speeding the registry
  compile path.

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
    the previous step's boxes; a retargeted reflow continues from the drawn box (CSS-transition
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
- Repo-wide rules are in `AGENTS.md` `## Repo rules`.
- 2026-11-08 15:20 [orch]: PR #36 CI red twice on modules/text/test/web/live-runs.test.ts (Chromium live vs literal control screenshots): a frame wait and a 3 s poll didn't help — the mismatch persists on CI only (same Chromium 1248, source-hashed bundle cache; passes 5/5 locally); pushed diagnostics (renderer, step, both SVGs, inked canvas pixels) to read from the next CI log (unverified cause)

# Work log

Orchestrator memory. Ticket agents keep their notes in their own report files
(`modules/<module>/<TICKET>-REPORT.md`, `tests/oracle/<TICKET>-REPORT.md`) and don't edit this file.
History is in git, not here: `git log`, `docs/LOG.md` (one entry per phase), `docs/PLAN.md`,
`docs/parity/*-closure.md`, `docs/benchmarks/agent-native.md`. The timestamped log this file used to
carry (2026-11-06 → 2026-11-08) is at `git show 39ab6837:WORKLOG.md`.

## Now

- Goal: a smaller, agent-native Rive for animated web UI. Order: P7 (minimal layout, host fit,
  bindable artboards, 18 P6 text carry-overs) → P8 rigging (heavy).
- Branch `p7` from main 8ffd714. Design `design/p7/DESIGN.md`; briefs `design/p7/tickets/`.
- Merged on p7: P7-1 text split (+ `measureText`), P7-3 host fit (17 rows ready; `fit="layout"`
  stubbed), P7-5 bindable artboards (partial), P7-2 layout core (16 rows done).
- Running: P7-4 animated reflow + `measureText` and `fit="layout"` wiring, P7-6 text carry-overs,
  P7-7 finish bindable artboards.
- Next: merge them; reflow-card benchmark (design §9); parity closure (P7 rows: 16 done, 41 planned
  before these tickets); `test:scope -- changed --no-browser` once; PR.
- Gates now: core+web 21,165; largest scene 53,982; app-UI 103,294; runtime sum 125,716;
  authoring 14,899; Rive-class 135,671. In scope 820/886.

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
    the previous step's boxes.
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
- Repo-wide rules are in `AGENTS.md` `## Repo rules`.

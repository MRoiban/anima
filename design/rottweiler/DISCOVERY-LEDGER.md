# CLI discovery Rottweiler ledger

Branch `cli-discovery` against `origin/main`. Scope: `packages/cli/src/**`, `tools/cli-docs.ts`,
`tools/modules.ts`, module manifest `summary` lines, both `llms.txt`, `docs/CLI.md`. One reviewer per
round on Codex Web (GPT-5.6 Sol Web, medium). The orchestrator reproduces each finding, then fixes it
with the smallest change plus a regression test (`packages/cli/test/rottweiler-discovery.test.ts`),
or pushes back with the reason.

| id | severity | finding | outcome |
| --- | --- | --- | --- |
| R1-1 | major | Options placed before the command (`--summary inspect f`, `-e snapshot sample f`), accepted on main, were rejected as unknown. | fixed: the command is found by skipping leading options (value-taking options from every command's declarations); the skipped tokens are validated against the resolved command |
| R1-2 | major | `search "make a bone chain follow the pointer"` returned no IK result. | fixed: general synonym `chain → ik, rig, bone` (a bone chain is the IK/rig concept); quiz and held-out results unchanged |
| R1-3 | major | `docs a11y <section>` ignored the section and printed the whole 34 KB page, also for nonexistent sections (exit 0). | fixed: a second word narrows any resolved page to that heading (levels 2–6: module pages are demoted under their spec chapter); unknown sections exit 2 with a suggestion |
| R1-4 | major | `schema`/`docs` topic misses printed plain text under `--format=json`. | fixed: misses (and unknown schema fields) emit `{error, suggestions, help}` JSON |
| R1-5 | minor | The documented `examples bell --print` failed: `bell.ani` and `bell.animl` both matched. | fixed: a source and its built sibling count as one example; the `.animl` source is printed |
| R1-6 | minor | `anima --format=bogus` exited 0 with the overview. | fixed: leading `--format` values are validated before the no-command overview |
| R1-7 | minor | Fish completion ignored command aliases (`anima check --f`). | fixed: aliases complete like their command |
| R1-8 | minor | `packages/cli/llms.txt` was not in the package `files`. | fixed: added |

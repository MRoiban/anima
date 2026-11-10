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
| R2-1 | major | A leading attached short value (`-esnapshot sample f`) was rejected; main and the after-command form accept it. | fixed: the leading scan accepts `-xVALUE` for value-taking short options |
| R2-2 | major | `docs convert convert` printed the whole page: combined pages repeat the root slug. | fixed: a matching section below the page root wins over the root heading |
| R2-3 | minor | `features pait` gave no suggestion. | fixed: unknown features are a usage issue with feature-name suggestions (text and JSON) |
| R2-4 | minor | `schema --all --json-schema` silently ignored `--json-schema`. | fixed: usage error |
| R2-5 | minor | `schema --search ''` printed the topic index with exit 0. | fixed: usage error `--search needs at least one word` |
| R2-6 | minor | Bash completion assumed the command is the first word (`anima --format json search --k` completed nothing). | fixed: the script skips leading options and their values to find the command |
| R2-7 | minor | Zsh completion ignored command aliases. | fixed: aliases are listed and share their command's case |

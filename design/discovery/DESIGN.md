# Discovery: find any Anima capability from the CLI

Owner request (2026-11-10): an agent or a human must be able to find, from the `anima` CLI alone,
everything they need to build with Anima. Reference for CLI quality: the Bedrock CLI rework
(MRoiban/bedrock PR #9): one command table, layered help, "did you mean", exit codes, `--json`,
`llms.txt`, drift tests.

## Baseline (main a494e9a1, measured by the orchestrator)

- No `help` command; `help <cmd>`, `<cmd> --help` and `-h` print the whole 40-line overview; no
  `version` / `--version`.
- Unknown commands and flags never get a suggestion; the message for a bad flag is Node's
  `parseArgs` text ("place it at the end of the command after '--'") followed by the full overview.
- One global option set: any command silently accepts any other command's flags.
- The overview is one ungrouped list with duplicates (`render` ×3; `new`, `build`, `schema`,
  `inspect` ×2): usage text lives in `HELP` and in each command's own error strings.
- Nothing lists the features (`requires` names) or what each enables.
- No vocabulary listings: ease names and functions, expression functions, listener events, script
  commands. `schema --search` finds registry fields, types and diagnostics only (`easing`, `cubic`,
  `spring`, `contains`, `hover` return nothing); it never searches docs or examples.
- 71 examples (28 in `examples/`, 43 under `modules/*/examples/`) are invisible; `new --sample`
  offers 3.
- `anima schema` without arguments prints 2,093 lines; object fields print as `obj`; the layout
  field prints an empty markup name (`↔ layout: obj`).
- No `llms.txt`, no machine-readable index.
- Benchmark friction already logged: missing `docs ik`/`skin`/`constraint`, undiscoverable
  `semantic` script command, `schema text` answering with a generic usage message, no did-you-mean
  in `schema textInput`, `docs authoring` too long for one output.

## Target and measurement (owned by the orchestrator; agents run it, never change it)

`node tools/discovery.ts` prints, and `--json` emits:

1. **Quiz:** `tools/discovery-quiz.json` holds natural-language task queries written the way an
   agent types them ("hover effect", "make a bone chain follow the pointer"). A query passes when
   `search(query)` returns, within its first 5 results, an entry whose `name`, `feature` or one of
   its `rows` is among the query's expected targets. Target: **100 %**.
2. **Rows reachable:** for every parity row with `anima.status` `done` (886), `search(row.capability)`
   returns within the first 5 an entry listing that row id. Target: **100 %**.
   A docs topic counts only when it is more specific than a bare contents page (`spec`,
   `authoring`, `markup`), tightened after D-B's first run linked most rows to `spec`.
3. **Rows with docs and an example:** of those 886, how many resolve to a `docs` topic that
   `anima docs` can print and to at least one example file that loads. Target: 100 % docs;
   examples as many as exist (report the number, don't invent examples to fill it).

Baseline: quiz and rows are 0 % (no `search`); `schema --search` as a proxy is reported by
`node tools/discovery.ts --baseline`.

Guard: `npm run check` stays green; runtime size gates untouched (the CLI has no size limit, and
nothing here may add code to `packages/core` or `packages/web` bundles).

## Decisions (orchestrator, 2026-11-10; owner may revisit)

- **D1 One command table** (`packages/cli/src/commands.ts`, type in the same file): name, group,
  summary, usage lines, per-command options (with value names and allowed values), examples,
  aliases, "see also". Help, parsing, flag validation, suggestions, `help --json` and completion
  all derive from it. No other usage text may exist.
- **D2 Help layers** like git: bare `anima`, `anima help`, `-h`, `--help` print the overview
  grouped by task (Write · Check · See · Find · Ship · Fonts and assets); `anima help <cmd>`,
  `anima <cmd> --help` / `-h` print that command's page (usage, options, examples, see also);
  `anima help --json` prints the whole table. Help exits 0.
- **D3 Errors** name the bad word and suggest: `anima: 'rendr' is not an anima command. See 'anima
  help'.` then `The most similar command is` + candidates (git weighting: transpositions free,
  deletions cheap, prefix matches first, cutoff relative to length). The same for subcommands,
  per-command flags (`--sze` → `--size`), enum values (`--fit cover` vs `covr`) and topics. Never
  print the whole overview after an error; print one line pointing at `anima help <cmd>`.
- **D4 Exit codes** unchanged: 0 ok, 1 diagnostics or failed check, 2 usage. `anima version` and
  `--version` print the package version.
- **D5 Per-command flags.** A flag that the command does not declare is a usage error with a
  suggestion, not silently accepted. `--format=json` stays global.
- **D6 Capability index** (`packages/cli/src/discover/`): one list of entries built at call time
  from the sources of truth — the module registry and manifests (features), the schema registry
  (types, fields, elements, value types), core and module vocabularies (eases, expression
  functions, listener events, script commands, diagnostics), `docs` headings (spec, authoring,
  module SPECs), examples (their `requires`, element types and leading comment) and
  `docs/parity/inventory.json` (done rows). Hand-maintained data is limited to a synonym table
  (`discover/synonyms.ts`, concept words → index names, e.g. hover → `enter`/`leave` listeners).
  Every entry says where to go next: a `docs` topic, examples, a `schema` topic.
- **D7 New commands:** `anima features [name]` (all features with one-line summaries; one feature's
  elements, types, fields, animatable addresses, events, docs topics and examples);
  `anima search <words…> [--kind k] [--limit n]` (ranked index search); `anima examples [topic|name]
  [--print | -o dir]` (list, filter by feature or word, print or copy one). All take `--format=json`.
- **D8 Docs topics** resolve by module name, feature name, row id and element name as well as by
  slug (`docs ik`, `docs skin`, `docs constraint`), with did-you-mean on misses.
- **D9 Bounded output.** `anima schema` without a topic prints the topic index, not every field;
  long docs sections print their contents first (existing rule) and every listing honours
  `--limit`.
- **D10 Agent entry points:** `llms.txt` at the repo root and `packages/cli/llms.txt` (short: what
  Anima is, the loop, the discovery commands, `anima help --json`); `docs/FOR-AGENTS.md`,
  `docs/README.md` and `README.md` point to them. A drift test checks every table command appears in
  `docs/CLI.md` (generated from the table, `--check` in CI) and in `llms.txt`.

## Work split (one owner per file)

| Ticket | Owner | Files |
| --- | --- | --- |
| D-A command table, parser, help, suggestions, version, completion | Sol Web | `packages/cli/src/{cli.ts (HELP, parseArgs, run dispatch only), main.ts, commands.ts, suggest.ts, help.ts, completion.ts}`, `packages/cli/test/{commands,help,suggest}.test.ts` |
| D-B capability index and `features` / `search` / `examples` | Sol Web | `packages/cli/src/discover/**`, `packages/cli/test/discover*.test.ts` |
| D-C schema/docs output, topics, agent files, generated CLI reference | Sol Web | `packages/cli/src/{schema-view.ts, docs-view.ts}` (moved out of `cli.ts` below `run`), `docs/CLI.md`, `tools/cli-docs.ts`, `llms.txt`, `packages/cli/llms.txt`, `docs/{FOR-AGENTS,README}.md`, `README.md`, `packages/cli/test/{schema-view,docs-view,cli-docs}.test.ts` |
| measurement | orchestrator | `tools/discovery.ts`, `tools/discovery-quiz.json`, this file |

`cli.ts` is shared: D-A owns everything from the top of the file through the end of `run()`;
D-C owns the schema and docs functions below it, moving them to their own files; D-B adds no edits
to `cli.ts` (D-A wires the new commands to `discover/` through the contract in
`packages/cli/src/discover/api.ts`).

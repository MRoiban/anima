# Anima for coding agents

Anima is built to be written by agents. This page is the short operating manual: how to look
things up, the edit → check → run loop, and the output formats you can parse. It covers *using*
Anima to make scenes. To change Anima itself, read [`AGENTS.md`](../AGENTS.md) at the repo root.

Run the CLI from a checkout with `npx anima …` (or `node packages/cli/src/main.ts …`), on Node 24.
Every command below works without a browser.

## Look things up instead of guessing

| Question | Command |
|---|---|
| Which topics exist? | `npx anima docs --list` |
| How do I author X? | `npx anima docs <topic>`, for example `npx anima docs timelines-and-keyframes` |
| What does feature X do, normatively? | `npx anima docs <feature>`, for example `paint`, `layout`, `text`, `a11y` |
| Which attributes does a node or field take? | `npx anima schema <type>` (`circle`, `fill`, `timeline`, `state`, `listener`, …) |
| Which property does something? | `npx anima schema --search "corner radius"` |
| What can be animated or bound? | `npx anima schema <type> --animatable` / `--bindable` |
| The whole JSON Schema | `npx anima schema --json-schema` |
| A working example | `examples/*.animl` and `modules/<feature>/examples/*.animl`, each with its `.ani` |

The docs, the schema and the validator are generated from one registry, so they agree with each
other and with the runtime. Spellings differ between the formats: AniML uses kebab-case attributes
(`timeline-x`, `fill-rule`), JSON uses camelCase (`timelineX`, `fillRule`). `anima schema` prints
both.

## The loop

1. **Edit** the `.animl` file. Start from an example, or scaffold with `npx anima new <dir> --sample
   bell|moon|progress`, or from an SVG glyph with `npx anima new <name> --glyph icon.svg`.
2. **Validate:** `npx anima validate scene.animl --format=json`.
3. **Run headlessly and assert:** `npx anima sample scene.animl -e "<script>"`.
4. **Look**, when appearance matters: `npx anima render scene.animl -o out.png --sheet 8 -e "<script>"`.
5. **Build** the shippable `.ani`: `npx anima build scene.animl -o scene.ani`.
6. **Format:** `npx anima fmt scene.animl --write`; canonical formatting keeps diffs small.

Repeat 2–3 until there are no diagnostics and every assertion holds.

## Validation output

```sh
npx anima validate switch.animl --format=json
```

```json
{"file":"switch.animl","ok":false,"diagnostics":[{"code":"bad-condition","severity":"error",
 "pointer":"/machine/layers/switch/states/on/on/0/when","message":"\"not on\": cannot read \"not on\"",
 "hint":"\"not\" and \"or\" are bind-expression syntax: write !name, and one transition per \"or\" branch",
 "line":18,"column":17}]}
```

- **`code`:** stable; act on it.
- **`pointer`:** the JSON pointer into the compiled `.ani`.
- **`line` / `column`:** where the problem is in the AniML source.
- **`hint`:** usually the fix.

Severities are `error` (the file is rejected) and `warning` (it loads). The exit code is 0 when the
file is valid and 1 when it has errors. Loading is all or nothing: there is no partial document.

## Headless runs

`anima sample` runs a script (spec §11.2) and prints one JSON line per `snapshot`:

```sh
npx anima sample examples/switch.animl -e "pointer click 12 7
advance 0.3
expect thumb.x == 10
expect on == true
snapshot thumb.x"
```

```json
{"time":0.3,"values":{"thumb.x":10},"states":{"switch":"on"},"events":[],"settled":true}
```

Script commands you'll use most:

| Command | What it does |
|---|---|
| `advance <s> [in <n>]` | Step time (n sub-steps). Queued writes apply on the next step, and a transition taken in a step starts its blend on the following one, so after `set`/`fire`/`toggle` write `advance 0` before timing a blend. |
| `set <input> <value>`, `fire <input>`, `toggle <input>` | Queue input changes. |
| `pointer click <x> <y>`, `pointer drag x0 y0 x1 y1 [in n]` | Pointer input in grid units. |
| `key down\|up <key>`, `focus target <id>` | Keyboard and focus. |
| `semantics`, `semantic <id> tap` | The accessibility tree and its actions. |
| `motion reduce\|full` | Reduced motion on or off. |
| `data set $path <value>`, `data dump` | View-model data. |
| `expect <address> ==\|!=\|<\|>\|~ <value>` | Assert; `~` allows 1e-6 error. |
| `snapshot [--all] [--semantics] [address …]` | Print state. |

- **Exit codes:** `sample` exits 1 when an assertion fails and 2 for a malformed script, and prints
  diagnostics (`script-expect`, `script-usage`, `script-target`) on stderr.
- **Determinism:** playback is deterministic, so the same script gives the same numbers on every
  machine. Assert exact values.
- **Interactive sessions:** `npx anima session scene.animl` keeps a player open. It reads one
  command, or `{"cmd": "…"}`, per stdin line and answers with one JSON line each.

## Looking at frames

- `render` writes PNG or SVG, one frame (`--at 0.3`) or a contact sheet (`--sheet 8 --over 0.6`),
  after an optional script.
- `--dark`, `--color slot=#hex` and `--current #hex` preview theming.
- `render --compare glyph.svg` checks the rest frame pixel for pixel against the source SVG, which
  is useful when you animate an existing icon.
- `npx anima inspect scene.animl` summarises nodes, what animates them, inputs and the state graph,
  without rendering anything.

## Rules that save iterations

- **Coordinates:** grid units with `y` down. Positive rotation is clockwise. Nesting does not move
  the origin: a child's coordinates are still the document's grid. Pivots are explicit.
- **Features:** declare every feature the scene uses in `requires`; using a feature's fields without
  it is `undeclared-feature`. [FEATURES.md](FEATURES.md) lists them.
- **Guards:** transition conditions use `!name` and `and` (or `&&`). There is no `or` and no `not`:
  write one transition per alternative. Bind expressions are a different grammar, where `not` and
  `or` exist.
- **Timelines:** `@end` in a guard needs a `once` timeline. `reducedMotion="end"` jumps to the end
  for users who ask for less motion.
- **Colours:** animated colours must be literals (`#rrggbb`). Slots theme but don't animate; use
  `colormix` to blend two slots.
- **Common mistakes:** the authoring guide's section of that name lists the ones agents hit most
  (`npx anima docs common-mistakes`).

## Shipping

- **Single `.ani`:** load `packages/web/dist/anima-icon.js` and the feature modules the scene needs,
  then `<anima-icon src="scene.ani">`. See [WEB.md](WEB.md).
- **One bundle:** `npx anima bundle --modules <entries> -o anima.js`.
- **A demo page:** `npx anima build scene.animl --out-dir site` writes `index.html` with the runtime.
  Serve it over HTTP.

## Further reading

- [GETTING-STARTED.md](GETTING-STARTED.md): a full worked example.
- [AUTHORING.md](AUTHORING.md): every authoring topic, the same text `anima docs` serves.
- [`spec/SPEC.md`](../spec/SPEC.md) and [`spec/ANIML.md`](../spec/ANIML.md): the normative format and
  markup.
- [`docs/benchmarks/agent-native.md`](benchmarks/agent-native.md): how fresh agents fare authoring
  Anima versus Rive.

# Tooling observations

The fresh `rive/scene.rml` is an independently authored numeric view-model probe. Captured on
2026-11-07 with the local runner, using only local headless commands:

```
cd modules/tooling/oracle/rive
~/.rive/bin/rive . --commands=commands.txt
```

No source code, CLI documentation text, or binary format was copied; no native binary was read or
converted. Generated build directories and native binaries are removed after capture. `session.txt`
and JSON observations are retained, including rejected commands. The numeric data write/dump is
compared by the `P3b native observations` tests in `packages/cli/test/agent-tools.test.ts`.

- `tooling.headless-command-session`, `headless-data`, `headless-data-dump`, `data-debugger`:
  accepted commands, count 0→3 observed. Native reload resets count to 0; Anima deliberately
  restores compatible data as required by DESIGN §5. The retention difference is asserted explicitly.
- `tooling.headless-key`, `headless-gamepad`, `headless-wheel`, `headless-touch`:
  script dispatch is compared to the existing independent `input-key-down`, `input-gamepad-button`,
  `input-wheel-scroll`, `input-multi-touch` native data snapshots. The original snapshots and limits
  are unchanged. `headless-pointer` uses the same API as the existing `input-pointer-drag` oracle,
  with a separate CLI drag interpolation test.
- `tooling.headless-data-filter`, `headless-data-stream`: oracle skipped for the persistent-command
  syntax. The native runner explicitly rejects `data-dump-filter` and `data-dump-every` as unknown
  commands (session.txt). The startup flags use a different schema/stream header and glob grammar;
  the Anima prefix union and since-snapshot change contract are independently tested.
- `tooling.test-assertions`: oracle skipped: no counterpart to Anima script `expect` in the native
  interaction command protocol; this is CLI exit-status behavior, covered with passing/failing assertions.
- `tooling.benchmark`: oracle skipped: timings are machine/engine/workload dependent; the native
  GPU path is not a faithful numerical counterpart to renderer-neutral JS step/draw costs. Statistics,
  units, frame count, errors and output formats are unit tested. Measurement follows tools/perf.ts;
  see docs/research/rive-web-runtime.md on native versus host overhead.
- `tooling.seed`: pending, not skipped as complete. Existing machine/convert streams are private;
  explicit --seed fails clearly for random documents. A shared runtime source remains necessary.
- `tooling.data-breakpoints`: pending. Current replay traps final value changes before the live step;
  it does not observe same-value or intermediate overwritten writes. Writer candidates are reported,
  without claiming exact instrumentation of every runtime writer.

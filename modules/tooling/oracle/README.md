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
- `tooling.seed`: shared core source implemented. Native seed is for script random; no matching
  control of native transition selection exists. Exact LCG shared machine/converter tests and
  `spec/conformance/tooling-seed` provide independent evidence; see the central skip note.
- `tooling.data-breakpoints`: exact write instrumentation is tooling-only. The native command
  protocol has no stop-before-write breakpoint/provenance output. Central skip note records this
  limit; same-value/transient, script/listener/action/binding writes and live-state preservation
  are independently tested in `packages/cli/test/tooling-leftovers.test.ts`.

## P3c-2 carry-over decisions

The six tooling rows use CLI contract tests in `packages/cli/test/p3c-tooling.test.ts`.
Benchmark memory reports JS heap samples, not a native/WASM quantity (see the host/native boundary
in `docs/research/rive-web-runtime.md`). Project globs/constants, schema filters, section paging,
doctor's loopback port and emulated-device checks, expected-error groups, PNG naming and sequential
render queues are authoring contracts without a faithful native numerical screenshot counterpart.
They are skipped for native comparison, rather than counted as matching native output.
WebM is validated through real Chromium MediaRecorder and its EBML container header; encoded bytes
and wall-clock timestamps are intentionally not golden images. Missing Chromium is independently
tested to return `build-encoder-unavailable`, with no partial output file. No new native commands,
source code, binaries, benchmark records or oracle measurement inputs were needed or changed.

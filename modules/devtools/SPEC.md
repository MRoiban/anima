# Optional browser diagnostics

Import `@anima-format/web/devtools` to install these host-only APIs. No document keys,
registry spellings, validation diagnostics, CLI switches or Player.step changes are introduced.

- `icon.stats` is a detached `{fps, frameMs, frames}` snapshot. `frames` and `fps` count
  scheduler frame calls in the trailing 1000 ms; `frameMs` is their mean measured execution
  time (step and draw), or zero with no samples. Paused/settled idle time contributes no frames.
- `icon.perfMarks = true` or the host `perf` attribute records `anima:frame:start` and
  `anima:frame` measures around frame execution. The temporary mark is cleared after measuring.
  Measures remain available to PerformanceObserver/the performance timeline for the host to clear.
- `AnimaIcon.warnings = 'once' | 'always' | 'off'`, default `once`, controls the
  `AnimaIcon.warn(code, message)` policy hook. Once means one warning per code per page.
  There are currently no shipped runtime deprecation/console warnings to redirect; loader
  diagnostics and errors are unchanged. Future deprecations must use this hook.

Without this import the base runtime has identical behaviour and no diagnostics instrumentation.
The optional hook/wrapper follows the opt-in marks recommendation in
[web runtime research](../../docs/research/rive-web-runtime.md), points 12–13.
Oracle skipped: browser scheduling and Performance APIs have no faithful native local CLI counterpart.

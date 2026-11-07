# P3b-10a verification

The module report and its current row table are authoritative: 56 ready, six open;
all inventory statuses remain planned. checks.json records final command outcomes.

- size-clean-before.txt: frozen tracked HEAD, after npm ci restored missing tools.
  The first size run overlapped source edits and is discarded. size-final.txt uses
  the same unchanged tool after the final nested-Tab fix. No size inputs/budgets or
  reference sets changed. The development repeat probe was 4,107 B; it fit after
  sharing the existing collector and removing a redundant registry invariant check.
- fixtures.py: independent expected projections for keys, input limits and repeats;
  never runs Anima. Canonicalize its three emitted case.animl files with formatMarkup,
  then run node tools/build-animl.ts. The spoken-value fixture and both module examples
  are authored directly. All ANI and the schema/demo come from prescribed generators.
- scope-focused.txt: final module scopes, both engines, one worker. scope-firefox.txt
  independently resolves the earlier Firefox startup hook timeouts without changing
  limits. scope-changed-before-tab.txt is the earlier all-green 8,019-test broad run.
  scope-changed.txt is the final run after nested Tab and unrelated-key fixes.
- earlier-*.txt: compact failure excerpts, never represented as passing checks.
  Failures included a missing generated example, corpus census, the independent
  decompile reader missing value-text, generic focus-only keys being consumed by
  semantic inspection, and invalid AX projection expectations. These are corrected.
  Firefox startup hook timeouts disappear in isolated and final focused runs.
- native-range-ax.txt: standalone authored HTML, Chromium AX JSON and Playwright's
  native range/div projection. aria-valuetext is present, but that capture surface
  retains the native numeric value. Speech/benchmark success is not asserted.
- ../.. /oracle/focus-policy contains six native captures and the allowed replay.
  Four projections match 15 nodes / 30 focus booleans. focus-gap.txt records the
  uncorrected directional ancestor/origin policy difference, including a probe with
  explicit child boxes. The native condition marker is an unverified wiring probe.
- oracle-summary.json summarizes unchanged strict oracle output; no native finding,
  benchmark, measurement input, parity status or central case manifest was changed.
- perf-final.txt reports shared-load timings, not a controlled paired comparison;
  the <=3% timing acceptance remains unverified. No performance threshold changed.

Additional closed lifecycle regression: same-signature owner replacement retains
semantic snapshot identity but routes actions to the current child player. Dependency
subscriptions remain unimplemented; each semantics read still collects entries.
The painted-bounds and Solo/native visibility rows remain open as documented.

No binary/native build folder, copied native CLI documentation, dependency, licence,
publication, Glyphy change, push or pull request is part of this branch.

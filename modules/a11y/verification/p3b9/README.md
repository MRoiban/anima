# [P3b-9] Verification record

The current result and row table are in ../../REPORT.md. Logs named earlier-* are
failed attempts, not passing checks. Giant serialized assertion lines are omitted
from the retained excerpts; their temporary source filenames are recorded.

- evidence.py authors the 35 new semantic fixtures and independent expectations;
  it never runs Anima. Canonicalize AniML with formatMarkup, then regenerate ANI
  with node tools/build-animl.ts. Capability example pairs are compiled through
  the same public compile API (the global builder does not scan capabilities/).
- native.py and native-properties.py author the first two new native scenes.
  The third heading probe has its scene and commands under oracle/roles/heading.
  Captures are module-owned because the central oracle has no semantic-tree
  adapter. From each project directory, the permitted local commands are
  ~/.rive/bin/rive . --verify and ~/.rive/bin/rive . --commands=commands.txt.
  Keep observations unchanged; remove any generated build directory/binary before
  committing. No existing finding record or central measurement input is modified.
- size-before.txt comes from a clean tracked HEAD archive, with separate workspace
  package links, using the original tools/size.ts. The initial baseline process
  overlapped source edits and was discarded. size-after.txt is the final source.
- browser-bounds.txt records installed Chromium/Firefox APIs for a round-stroked
  M10 10L20 10 segment, width 4: ordinary getBBox, stroke-inclusive getBBox,
  getBoundingClientRect, in that order. It shows why stroke completeness is open.
- gap-probes.txt records the queued/narrower range, repeat-focus and late-focus
  failures. These are explicit unfinished behavior, not passing tests.
- scope-requested, scope-markup, module-order and final changed logs cover the
  kept implementation. The final native heading-only addition is rechecked in
  scope-heading.txt, after the broad run started; it changes no runtime code.
- Earlier genuine failures: unformatted new fixtures/corpus census; a focus-only
  condition regression; a TypeScript assertion indexing unknown; the heading
  union decompiler; wrappers installed in only one module arrival order. Each
  was corrected and rechecked; no assertion, timeout or budget was loosened.
- The two scaffold dry/run pairs succeeded; their generated
  TODOs were replaced with shared registry adapters, independent probes, examples,
  diagnostic coverage and module-owned native observations. Statuses stay planned.

No quiet paired performance acceptance is claimed. Perf logs are observations on
this shared machine. Protected data/bind/components and no-a11y source/bytes stay
unchanged; the inherited components baseline is 4,053 B, above the historical
4,051 B brief by 2 B before this work as well as after.

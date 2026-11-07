# P3c-8 numbered findings

These are module evidence, not edits to the protected oracle finding records.

1. **Zero-opacity bounds and order differ.** In `oracle/p3c8-visibility/frames/tree.json`,
   native retains `transparent` with null bounds and orders it after `choice`.
   Anima retains [18,8,4,4] and authored root order (`visible`, `transparent`, `choice`).
   Membership agrees for both Solo choices. The test compares membership for the visibility
   row and separately asserts the differing bounds; no raw capture was adjusted.
2. **Native condition wiring resolved.** The comparator must target the parent node, not its
   SemanticData child. Equal/notEqual provide focused/unfocused tests; a false right-hand boolean
   does not invert this condition. An explicit Idle90 pose is needed to observe departure from
   Mark70. The six fresh PNG centers70/70/70/70/90/70 now match Anima's ancestor-condition poses;
   prior failed drafts are recorded in the probe README, not promoted as runtime mismatches.
3. **Exact painted bounds still absent.** A butt-capped `M10 10L20 10`, stroke width4,
   reports [10,10,10,0] through the logical/CLI tree, instead of exact [10,8,10,4].
   The overlay consumes this same core box. The previous independent engine probe
   (`verification/p3b9/browser-bounds.txt`) measured Chromium ignoring stroke-inclusive
   getBBox (10,10,10,0) and Firefox honoring it (8,8,14,4) for a round-cap width4 stroke.
   The decided getBoundingClientRect-plus-half-stroke overlay and exact tooling stroke-outline
   seam are still unimplemented. No approximation is promoted; `a11y.tree-bounds` stays open.
4. **Native semantic bounds can lag animated paint.** The final native sequence's outside PNG places
   its marker at x89..90, but semantic JSON still reports x69,width2 (earlier center70). The
   unconditional control conversely paints69..70 while reporting89,width2.
   `oracle/p3c8-condition/verify.ts` independently asserts both raw results. Thus native semantic
   bounds alone cannot be used to judge the condition's animated outcome. No capture is adjusted.

Directional child → right sibling → next outside now matches the retained native capture.
No remaining mismatch was observed for that sequence. Broader spatial policy equivalence is
not inferred from it; scoped edge policy remains Anima's specified behavior.

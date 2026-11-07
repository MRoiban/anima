# [P3b-9] Oracle dispositions

The 16 role mappings and state/action/property projections use captured logical
trees in `roles/`, `roles/actions/` and `roles/properties/` and `roles/heading/`; see roles/P3B9.md for
exact counts and observed differences. This file records only the portions without
an equivalent observable in the permitted native headless interface. It does not
waive the technical gaps explicitly open in REPORT.md.

- `a11y.role-none`: native exposes a role-none wrapper; Anima deliberately lifts
  children. Both trees are captured/tested; direct wrapper equality is inapplicable.
- `a11y.state-modal`: native headless marks a dialog modal but retains siblings;
  Anima deliberately omits modal siblings per its contract. The difference is
  recorded numerically in roles/P3B9.md rather than treated as native equality.
- `a11y.state-live-region`: native exposes only an isLiveRegion boolean (captured
  as flag 512). Polite/assertive are browser announcement policies, not distinct
  native headless values. Their attributes/label changes are conformance- and
  browser-tested; announcement delivery has no headless oracle.
- `a11y.semantic-diffs`: native exposes tree snapshots, not a semanticDiff API.
  Anima's added/removed/changed keys and reorder contract use independent API
  expectations in closure.test.ts. Native snapshot changes supply state evidence.
- `a11y.headless-inspection`, `tooling.headless-semantics`: the native command dumps
  a forest but has no matching filtered-subtree command. Anima's `semantics <id>`
  and unknown-id diagnostic use real CLI and script tests; native forest capture
  supports the shared logical content.
- Trait rows: native stores capability masks; Anima derives traits from roles and
  authored states and does not serialize trait flags. All native masks are asserted
  stable across the four action captures, while the Anima role × state matrix
  tests false/true states without inventing a second trait field in the format.
- DOM-only rows: ../a11y-dom/oracle/SKIP.md records why a real browser's elements,
  keyboard behavior and accessibility tree have no faithful local headless native
  counterpart. Both browser engines remain the oracle for those host surfaces.

Dotted repeat focus, late focus registration, Solo/native visibility, exact painted
bounds, independent standalone string inputs and queued/narrower range behavior
are open work, not oracle skips. No existing finding record has been changed.

[P3b-10a] New native focus-policy captures verify ancestor flags/targeting/first
Tab traversal. The directional candidate mismatch and unverified native condition
probe remain explicit open gaps in focus-policy/README.md. New valueText, queued
range writes and string-path bindings use independent conformance and browser/API
checks: the native headless tree exposes a string value, without the structured
numeric slider range contract (benchmark P3b item 3). No full range-contract equality
is claimed. Registration and owner replacement are Anima host lifecycle operations,
with no matching local native command; their direct regression tests are the oracle.

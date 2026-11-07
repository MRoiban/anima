# P3b-10a native focus policy probe

Independently authored local scene; no external source or documentation text is
copied. Run from this directory:

```
~/.rive/bin/rive . --verify
~/.rive/bin/rive . --commands=commands.txt
```

The six captures record ancestor focus, explicit parent targeting, initial Tab
traversal, directional traversal and departure from the ancestor. Mask 128 is the
native focused state; mask 64 is focusability. Parent/child focus is
`parent+child → parent → parent+child → parent+sibling → outside`.
`test/core/focus-native-policy.test.ts` matches the first three captures against
`examples/focus-ancestor-policy.animl`: 12 nodes / 24 state and trait booleans before hiding.
The hidden-child capture also matches the remaining parent/sibling/outside projection.
Together the four compared stages cover 15 nodes / 30 state and trait booleans.
The command file remains the independent native action sequence.

These captures plus repeat/late-registration regressions make ancestor focus,
explicit targeting, retargeting, focused state, Tab focus and the focusable trait
closure-ready. Two limitations keep spatial focus, focus-action-traversal and the
focus-condition row open:

- Without explicit semantic/focus bounds on each child, Anima synthesizes focus
  points at the node transform origin. Its directional traversal can select the
  focusable ancestor. For `right`, native selects sibling while Anima selects
  parent; the following next selects outside in native and child in Anima. See
  `verification/p3b10a/focus-gap.txt`. Matching semantic bounds alone does not fix
  ancestor exclusion in directional candidate selection. This policy needs an
  optional semantic-focus seam beyond the remaining 21 B in focus / 3 B in actions.
- The second state-machine layer is an **unverified condition probe**. Its marker
  would move from x=90 to x=70 if the authored ancestor condition matched. All six
  captures retain marker bounds x=89 (center 90). A component-property comparator
  variant did the same. The accepted wiring has not been established as a faithful
  native counterpart; no native condition equality is claimed. Anima's own ancestor
  condition is independently covered in a11y-focus-condition and closure.test.ts.

The first replay was started from the repository root and could not write relative
frame paths. Running from this project directory fixed those output errors. The
initial condition draft used unsupported AnimationState name attributes; removing
those attributes made verification succeed. These are recorded authoring failures,
not changes to native measurements or waived comparisons.

Native hidden/modal and role/state captures remain in ../roles/. Dotted repeats,
late registration and same-signature owner replacement use Anima host regressions;
there is no equivalent registration/owner-replacement interface in this local
native command surface. No binary or build directory is retained.

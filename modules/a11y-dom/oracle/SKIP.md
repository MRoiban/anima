# DOM overlay oracle dispositions

The rows below have no faithful Rive local headless counterpart: a real browser's
shadow-DOM elements, native keyboard behavior, focus lifecycle and accessibility
tree cannot be measured by the permitted headless CLI. They are browser-verified
in Chromium and Firefox (`test/web/overlay.test.ts`), including ariaSnapshot().
No native file, generated native scaffold, oracle finding or measurement input is
used or altered. This is a host-layer skip, not a claim of native comparison.

- a11y.web-overlay
- a11y.overlay-policy
- a11y.focus-sync
- a11y.roving-focus
- host-api.semantic-overlay
- host-api.keyboard-focus
- host-api.low-level-focus
- a11y.state-live-region (DOM half only)
- host-api.low-level-semantics (DOM half only)

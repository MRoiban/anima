# P8-7 report

## Checkpoints

- 2026-11-10 00:13: created branch `p8-7`, ran `npm ci`, dry-ran and applied `new-capability` for `rigging.scroll` → scaffold generated, parity left planned.

## Final

Pending implementation and verification.
- 2026-11-10 00:20: implemented the base `scroll` rig constraint with x/y/both axes, clamped grid-unit offsets, per-player state, bound/animated override detection, local-axis translation and derived 0..1 percent outputs; set the runtime entry to heavy 1,024 B over rig.

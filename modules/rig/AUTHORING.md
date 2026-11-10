# Rig authoring

## Pointer-driven IK with an eased release

Put the IK constraint on the chain tip and move its target from pointer input. While the pointer is
active, write the pointer position into the target node's `x` and `y`. On release, leave the target
where it is and play a short timeline that eases the IK constraint's `strength` from 1 to 0. This
lets the arm return to its unconstrained pose without moving the target through the shoulder.

For a constraint at `fore.constraints.0`, a release track can be:

```xml
<timeline name="release" duration="0.2">
  <track target="fore.constraints.0.strength">
    0   1 cubic(0.4,0,1,1)
    0.2 0
  </track>
</timeline>
```

For a two-bone chain with lengths `l1` and `l2`, the target also has an inner unreachable region.
If its distance from the shoulder is less than `|l1 - l2|`, the chain cannot reach it. Avoid driving
the target through that dead zone; fading `strength` on release is a simple way to disengage IK
without requiring such a target path.

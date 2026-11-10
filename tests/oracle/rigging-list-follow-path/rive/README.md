Native expressibility follow-up with the local Rive CLI 1.9.x.

Attempt 1 used `ListFollowPathConstraint` on a parent node with three rectangle children, `distance=0`, `distanceEnd=1`, `distanceOffset=0`. The RML compiler accepted the scene, but the headless capture left all three rectangles overlapped at the origin, so this route does not expose faithful native list distribution.

Attempt 2 used three ordinary native `FollowPathConstraint` children on the same straight target, with distances 0.3, 0.6 and 0.9. Those distances are exactly Anima's D19 positions for `start=0.2`, `end=0.8`, `shift=0.1`, n=3. This produces visibly distributed rectangles and compares against the matching Anima `spreadAlongPath` scene at raw max delta 1 with 0/57,600 pixels over 16. It validates the resulting placement geometry, but it is a manually expanded counterpart rather than evidence that the native `ListFollowPathConstraint` itself distributes children on this CLI/headless route.

`scene.rml` retains the successful per-child-distance control. The skip remains scoped to unavailable direct native list-constraint behavior. Generated build output and binary files are not retained.

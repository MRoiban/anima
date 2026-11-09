Invalid IK shapes are covered by `rigging-ik.test.ts`: a constraint on a non-bone reports
`rig-ik-host` at the constraint pointer, and a `bones` value longer than the available parent chain
reports `rig-ik-chain` at the `bones` field. Each assertion includes the diagnostic code, pointer,
message and hint.

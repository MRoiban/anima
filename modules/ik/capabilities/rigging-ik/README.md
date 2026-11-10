# Inverse kinematics

Implemented by the `ik` module through rig's `registerConstraint` seam. The normative contract is
`spec/SPEC.md` `## ik`; diagnostics are covered in `modules/ik/test/core/rigging-ik.test.ts`, and the
deterministic reach/straighten evidence is `spec/conformance/rigging-ik/`.

The richer interactive example is `modules/ik/examples/reach.animl`. Native oracle evidence remains
orchestrator-owned until the measured raw comparisons are promoted into `tests/oracle/cases.json`.

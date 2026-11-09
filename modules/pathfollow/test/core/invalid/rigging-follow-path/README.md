`rigging-follow-path.test.ts` covers the capability-specific invalid target: an `alongPath`
constraint pointing at a group reports `rig-path-target` at the constraint's `path` field with a
message and repair hint. Structural field errors are handled by the registered rig descriptor.

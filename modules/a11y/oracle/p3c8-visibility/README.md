# P3c-8 visibility matrix

From this directory and then `solo-first/`, run `~/.rive/bin/rive . --verify`
and `~/.rive/bin/rive . --commands=commands.txt`. The two independent sources differ
only in which Solo child is active. Native sources are authored probes, with no
copied runtime code or documentation and no retained build folders/binaries.

The semantic-hidden parent and child, hidden drawable and inactive Solo child are
absent. The ordinary drawable and active Solo child remain. Zero opacity retains
its semantic node with null bounds and puts that node last. The corresponding
Anima test uses `visible` bindings for the active-branch selection; both choices
and switching back reproduce membership. Existing hidden/modal/disabled captures
remain in ../roles and ../focus-policy.

`test/core/visibility-native.test.ts` compares membership, and explicitly records
the opacity-bound/order difference rather than normalizing its bounds. See
P3C8-FINDINGS.md, finding 1. The first draft lacked a state machine: verify passed,
but the command reported no semantic tree; adding the inert machine made capture
work. Final captures are the files here, not that unsuccessful first run.

# P3c-8 native ancestor-condition capture

Run `~/.rive/bin/rive . --verify` and `~/.rive/bin/rive . --commands=commands.txt` from this directory,
then `node verify.ts`. Source is independently authored; no runtime source, CLI documentation text,
binary animation file or build folder is included.

The component comparator targets the **parent node** (0:10), rather than its SemanticData child
(0:110). Focused uses equal, unfocused uses notEqual; changing the right-hand boolean does not
invert this condition. Mark writes x70 and Idle explicitly restores x90. The six PNG marker centers
are70/70/70/70/90/70 for child, parent, first, right, outside and hidden. The Anima machine in
`test/core/p3c8.test.ts` matches all six. This closes the previously unverified ancestor condition.

Raw semantic bounds stay at x69 throughout this final sequence, including outside when PNG pixels
are89..90. A one-layer unconditional control paints69..70 while its JSON reports89,width2. Both
observations are asserted independently in verify.ts and recorded as finding4, without adjusting
any capture. Native semantic JSON alone cannot judge these animated outcomes.

Earlier accepted drafts used Enum/Id/Self or the SemanticData property's focused bit and retained
marker pixels89..90. The correct node comparator's inverse was initially attempted with a false
right-hand boolean, and an empty Idle animation did not provide an explicit reset. These drafts do
not establish runtime bugs. The temporary four-case node/property-key truth probe established that
parent/child targets work with propertyKey0 or1003 and inversion uses notEqual. No algorithm or
implementation from the native runtime was read.

The positive control's source is control.rml.txt: copy it as scene.rml into a fresh temporary project
with rive.yaml and control-commands.txt. Do not rename it in this project: the CLI combines all .rml
files, causing duplicate ids (an unsuccessful attempt was corrected by retaining the .txt suffix).
Other corrected setup errors were a wrong temporary cwd and a visibility draft without a machine.

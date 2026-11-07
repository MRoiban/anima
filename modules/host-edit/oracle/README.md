# Fresh local native observations

Capture: `cd modules/host-edit/oracle/rive && ~/.rive/bin/rive . --commands=commands.txt`.
The CLI compiled 529 B with zero errors/warnings, then captured initial/changed dumps.
The command process exits 1 because the explicitly tested unsupported commands are rejected.
No binary files or CLI documentation are retained.

`test/core/oracle.test.ts` compares 16 exact values: RGBA channels, canonical hex, enum index,
members, selected key, nested property and shared list-item property, initially and after writes, plus default instance metadata. Browser root selection is compared
to the independently captured native small artboard selection.
There is no adjusted tolerance or finding. List mutation/creation cannot be observed through
this CLI; commands and exact rejection messages are retained as evidence for skip.json.
The shared oracle manifest and measurement inputs are unchanged.

The same fresh capture declares an image property and rejects image writes by both asset name
and data URI. This supports the decoded-image skip; browser URL/Blob tests remain independent.

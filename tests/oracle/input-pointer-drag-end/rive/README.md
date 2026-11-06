# Independent drag reference

Authored native RML, not a conversion. Reproduce with
`python modules/input/capture-oracles.py` from the repository root. The command file captures
baseline, after one 12-pixel motion, and after release. The active state moves the blue rectangle
96 pixels (8 Anima grid units). There is no easing, transition fade or antialiasing budget slack:
all three frames compare with max channel delta <=2 and zero pixels over threshold 16.

Drag-start/end native listeners need a drag registration on the same target; the independent
scene includes an empty drag listener. An initial capture without it did not dispatch those
phases, while drag itself did. Adding that registration fixed the scene; no runtime behavior or
comparison limit was changed. The generator uses only local headless --commands, and deletes
produced .riv files without reading them. CLI documentation/schema text is not committed.

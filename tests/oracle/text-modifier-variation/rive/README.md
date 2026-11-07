# Independent native text-effect probe

Uses only the original generated Anima Test font. Reproduce from this directory with
`~/.rive/bin/rive . --commands=commands.txt`; the output is frames/0.png. Delete generated build/
and binary artifacts without reading them. The authored scene uses 12 native pixels per Anima unit.

P6-9a accepts this explicit-leading/equivalent-origin control. See
`tests/oracle/TEXT-EFFECTS-PROBES.md` for mappings, measured differences, contour verification and
per-case limits; `tests/oracle/cases.json` is the completed comparison manifest.

This proves wght only; the arbitrary-axis Canvas portion keeps the variation row planned.

# Text outline conversion

`anima flatten example.animl --font sans-serif=fixtures/fonts/anima-test.ttf -o outlined.animl`
freezes the original generated-font A into an editable path. There is no new runtime field:
text input uses the existing registry and AniML forms; output uses existing group/path forms.

Root/definition traversal, paints, clips, reference rejection and both output spellings are
specified in `modules/text/SPEC.md` and tested by `test/core/text-flatten.test.ts`.
The conformance source is the independent original-font rectangle, not converter-generated
expected coordinates. The pending oracle retains a real outline scene but needs native
comparison acceptance; `text.flatten` remains planned.

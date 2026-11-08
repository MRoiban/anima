# Text outline conversion

`anima flatten example.animl --font sans-serif=fixtures/fonts/anima-test.ttf -o outlined.animl`
freezes the original generated-font A into an editable path. There is no new runtime field:
text input uses the existing registry and AniML forms; output uses existing group/path forms.

Root/definition traversal, paints, clips, reference rejection and both output spellings are
specified in `modules/text/SPEC.md` and tested by `test/core/text-flatten.test.ts`.
The conformance source is the independent original-font rectangle, not converter-generated
expected coordinates. The independent live-text raster acceptance and evidenced native conversion skip close this row
without assigning a new oracle budget.

P7-8 closure: native observation/conversion limits are evidenced in tests/oracle/text-flatten/skip.json. Our core/tool/both-engine tests remain the implementation evidence. See modules/text/P7-8-REPORT.md.

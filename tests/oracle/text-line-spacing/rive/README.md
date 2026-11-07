Original-font two-line comparison of Anima symmetric explicit leading.
The native Text node is translated by half the extra line height (6px); see modules/text/SPEC.md.
The original unshifted source is scene-native-unshifted.rml.txt, with frames/native-unshifted.png.
To repeat that control, temporarily replace scene.rml with the .rml.txt contents, capture, then
restore it. Do not put another .rml file in this project: all .rml files compile together.
The completed comparison is reproduced with `python3 tests/oracle/capture-text.py text-line-spacing`.
No threshold absorbs the retained unshifted baseline difference.

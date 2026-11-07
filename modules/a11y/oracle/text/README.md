# P6 text semantic probe

Original scene, original generated `fixtures/fonts/anima-test.ttf`, local CLI only. No runtime
source, proprietary documentation text, external fonts or binary animation files were read.
Reproduce from `rive/` with `~/.rive/bin/rive . --commands < commands.txt`; the control replaces
scene.rml with control.rml.txt and uses commands-control.txt. Remove the generated build/ afterwards.
The empty initial captures were command-path/output-directory/state-machine setup errors; successful
raw sessions are retained, not interpreted as passing comparisons.

`frames/tree.json` reports **empty** labels for the text and its semantic container, although the
PNG paints the original runs AB + C. An explicit label remains `Override`. The second capture
(no SemanticData on the text) also leaves the parent label empty and omits the text semantic child.
The allowed `schema Text --all --json` / `schema SemanticData --all --json` observations exposed no
inference switch; their documentation prose is not copied here. Anima follows this ticket's
specified inferred-name behavior (`ABC`), so this is a retained native observation/difference,
not a closed equivalence claim. `a11y.inferred-text` remains planned for owner disposition.

Native text bounds are x10,y20,width18.0029297,height10. The deterministic Anima metric box is
x10,y20.5,width18,height10: the generated font's 1-unit line gap contributes 0.5 above its baseline.
The browser measurer has no independent line gap and gives y20,width≈18,height≈10. This is the
existing P6 metric policy, not a widened tolerance. Exact ink/path/stroke extents and the older
P3c butt-line counterexample remain outside this text-layout completion; `a11y.tree-bounds` stays
planned. Both engine tests verify the browser-backed box and the shared tool test checks the
independent 600/1000 advance and 800/200 ascent/descent arithmetic.

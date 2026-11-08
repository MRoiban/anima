Format: Rive markup (RML), with a 59-line Luau width-animation controller.

Wall time (first command to done): approximately 8 minutes, rounded up, including commit; first command 2026-11-08T12:15:12Z.

Check/validate/build/render runs: 16 CLI invocations: 5 verify, 3 inspect, 8 headless commands sessions (each builds once). Final verification: 0 errors, 0 warnings; final inspection: `problems: []`; final geometry assertions: PASS. Errors seen: unknown docs topic (1), Python `TypeError` on null geometry (1), Python `ValueError: substring not found` (1), shell output path not found (1), Python script path not found (1). No CLI validation/build/capture errors. Full ledger: `evidence/RUNS.md`; all session logs retained. Renderer emitted a depthStencil/MSAA fallback notice.

Source size: 621 lines, 25,968 characters across `scene.rml`, `width-motion.luau`, `rive.yaml`, `make_proof.py`, `check_evidence.py`, `proof.commands`, and `help.commands`. Scene alone: 151 lines, 9,406 characters. Excludes reports, evidence, and the copied permitted test font.

Brief items met (1–6), each with how you checked it:

1. Hugging button: met. Baseline semantic bounds measure button 70.0875015 px and label 46.0875015 px: exactly 24 px horizontal padding within numeric precision. Height is label height + 12 px. Native layout measures the text; its computed width feeds the animation controller. Padding, vertical gaps, chip hugging, and title data changes also pass numeric assertions.
2. Animated growth: met with the controller. Final per-frame semantic captures show widths 70.0875015 → 113.292191 at 0.15 s → 156.496872 at 0.3 s. Full shrink returns to 70.0875015 in 18 frames. Two interruptions are sampled every frame; reversal proceeds from 91.4231491 → 123.960022 at 0.15 s → 156.496872 at 0.3 s. Maximum frame delta stays below 4.802 px. A data write consumes one frame before the newly measured target arrives; that frame continues the previous motion. See `growth-*`, `shrink-*`, `interrupted-*`, and `reversal-*` evidence.
3. Filling chip: met. At row width 444 px, chip 2 measures 303.346863 px. Lengthening chip 1 changes its width from 54.2449188 to 185.298035 and reduces chip 2 to 172.293762. Assertions verify widths sum to row width with two 6 px gaps.
4. Hidden chip: met. Writing `hideChip3=true` removes chip 3 from the semantic tree and increases chip 2 to 252.701965 px. The remaining chips plus one 6 px gap exactly span the row.
5. Host fit: met. Capture logs select `contain` at 480 × 360 and 600 × 300, preserving authored 480 × 360 geometry. Switching to `layout` gives actual card bounds 600 × 300 and row width 564; chip 2 grows to 423.346863 with the original labels. Returning to 480 × 360 restores row width 444. PNGs supplement numeric evidence.
6. Proof: met. `proof.commands` captures semantic geometry and named data before/during/after motion, interruptions, hide, and both host sizes. `check_evidence.py` independently checks those outputs; `evidence/assertions.txt` records PASS and `geometry-summary.json` collects measurements.

Items not met or approximated, and why: no unmet brief items in the tested sequence. Button animation uses a helper script rather than native layout interpolation. The permitted test font intentionally displays geometric glyphs. Host fitting is demonstrated through the CLI host, not a separate browser page.

What was hardest; what the docs or diagnostics got wrong or left out: native layout interpolation and `DataConverterInterpolator` both restarted from an earlier endpoint on interruption. Neither clean verification nor inspection revealed that behavior. Computed text width also remained zero inside the initially narrow button until `hugUnbounded` was set. The final solution retains markup layout/measurement and explicitly interpolates from the current width. Documentation did not explain these interruption and measurement interactions; runtime geometry was essential.

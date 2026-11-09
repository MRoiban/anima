# P8-1b oracle analysis

Circles were replaced with centered 12×12 px rectangles in both independent scenes; native frames were recaptured and Anima frames rerendered. Each cell is maximum channel delta / pixels over 16, at 0, 0.5 and 1 seconds. All frames contain 57,600 pixels. The earlier 53 pattern came from circle/ellipse construction differences; these fixtures now expose transform differences without that systematic discrepancy.

| Probe | Before (0 / 0.5 / 1 s) | After (0 / 0.5 / 1 s) | Proposed budget and precedent |
| --- | --- | --- | --- |
| rigging-bone-chains | 53/22 · 53/25 · 53/20 | 1/0 · 52/17 · 42/23 | 65/0.4, path-morph edge AA |
| rigging-constraint-order | 53/44 · 53/44 · 53/44 | 1/0 · 1/0 · 1/0 | 16/2/0, common precedent |
| rigging-constraint-strength | 53/22 · 53/22 · 53/22 | 1/0 · 1/0 · 1/0 | 16/2/0, common precedent |
| rigging-distance-closer | 78/54 · 78/54 · 53/66 | 1/0 · 1/0 · 1/0 | 16/2/0, common precedent |
| rigging-distance-exact | 96/32 · 96/32 · 96/32 | 1/0 · 1/0 · 1/0 | 16/2/0, common precedent |
| rigging-distance-further | 53/66 · 78/54 · 78/54 | 1/0 · 1/0 · 1/0 | 16/2/0, common precedent |
| rigging-root-bones | 53/22 · 74/25 · 62/18 | 1/0 · 32/20 · 43/25 | 65/0.4, path-morph edge AA |
| rigging-rotation | 1/0 · 22/50 · 22/50 | 1/0 · 22/50 · 22/50 | 65/0.4, path-morph edge AA |
| rigging-scale | 1/0 · 1/0 · 1/0 | 1/0 · 1/0 · 1/0 | 16/2/0, common precedent |
| rigging-transform | 1/0 · 22/50 · 1/0 | 1/0 · 22/50 · 1/0 | 65/0.4, path-morph edge AA |
| rigging-translation | 53/22 · 53/22 · 53/22 | 1/0 · 1/0 · 1/0 | 16/2/0, common precedent |

All over-16 pixels in the four rotated probes lie on the rendered rectangle boundary (checked against both images and their four axial neighbours); none fell in the shared solid interior. The maximum over-16 fraction is 0.08681%. This is consistent with diagonal-edge rasterization differences. No solver error was exposed and no solver change was made. Budget proposals are for orchestrator review; no manifest or threshold was edited. Detailed raw per-frame values are in `oracle-raw.json`.

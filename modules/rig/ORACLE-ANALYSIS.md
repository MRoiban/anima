# P8-1b oracle analysis checkpoint

Compared the saved 240×240 Anima and native PNGs at 0, 0.5 and 1 s. Cells give over-16 pixels classified as boundary/interior. A pixel is counted as interior only when it and its four axial neighbours have green < 220 in both images; boundary therefore includes nearby background as well as shape edges. This is a conservative image-space classification, not proof of a rasterization cause. Coordinates and full max/over values remain in `oracle-raw.json` and the original reference images.

| Probe | 0 s | 0.5 s | 1 s | Visible element at differences |
| --- | ---: | ---: | ---: | --- |
| rigging-bone-chains | 22/0 | 25/0 | 20/0 | circle art edges |
| rigging-constraint-order | 44/0 | 44/0 | 44/0 | circle art edges |
| rigging-constraint-strength | 22/0 | 22/0 | 22/0 | circle art edges |
| rigging-distance-closer | 50/4 | 54/0 | 62/4 | circle art edges and overlaps |
| rigging-distance-exact | 32/0 | 32/0 | 32/0 | circle art edges and overlaps |
| rigging-distance-further | 62/4 | 54/0 | 54/0 | circle art edges and overlaps |
| rigging-root-bones | 22/0 | 25/0 | 18/0 | circle art edges |
| rigging-rotation | 0/0 | 50/0 | 50/0 | constrained rectangle edges |
| rigging-scale | 0/0 | 0/0 | 0/0 | none |
| rigging-transform | 0/0 | 50/0 | 0/0 | constrained rectangle edges |
| rigging-translation | 22/0 | 22/0 | 22/0 | circle art edges |

The probes draw no visible bone markers or target art: the unpainted target nodes have no pixel footprint. Differences localize to the painted art; no separate elsewhere cluster was observed. Four pixels in some distance frames meet the conservative interior criterion, so edge-only or anti-aliasing classification is not yet established. The repeated 22-pixel circle pattern suggests a circle construction/rasterization difference, but subpixel placement and native shape construction still need controlled experiments. Rotated rectangles have a distinct 50-pixel pattern. No fix, after measurement, or budget is proposed until those causes are established; 16/2/0 is the common existing precedent, not evidence that these probes meet it.

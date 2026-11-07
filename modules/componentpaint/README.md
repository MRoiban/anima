# Live component paint

Declare `components paint componentpaint`. JSON `fill: {paint: "component:row"}` is AniML
`paint="component:row"` on a painted shape. The component must be a local definition. The fill
cannot also supply a flat color, gradient type or ordered paint stack. An ordinary stroke remains
independent. The field is static, not an animation address; animate the component's own nodes.

Each painted shape owns an independent component Player, initialized from its definition and
advanced once per parent step, even when hidden. It uses the component's own default inputs,
data and machine. It inherits reduced motion. Paint sources receive no pointer events and do not
bubble events; their values/states can be inspected as `shape/paint/address`. They keep the parent
awake while animating. Shared definitions never share playback state. Recursive source graphs
(including ordinary nested instances) and source depth above 16 fail with `component-cycle`.

The component viewBox is a tile in shape-local grid units, including a nonzero origin; it repeats
in both directions and clips its contents to that viewBox. It does not implicitly stretch to the
shape bounds. This follows the existing image-paint original-size pattern convention. Transform,
opacity, clipping, compositing and the fill rule belong to the painted shape; source colors inherit
the host's currentColor and CSS slots. The SVG backend uses a pattern and a clipped nested viewport;
canvas uses an offscreen draw of the same resolved source frame through its optional source hook.
Neither backend serializes SVG into an image. Nested sources retain their own gradients, masks and
resource namespaces. Optional web sources load separately from the canvas renderer.

SVG declines sources whose features it cannot represent (for example angular gradients), with
`unsupported-render`, source feature, JSON pointer and a canvas hint. It never substitutes a flat
paint. Source restrictions are inherited from the actual backend, not fabricated oracle skips.

Design references: `design/p5b/DESIGN.md` §7; explicit graph ownership and SVG patterns follow
`docs/research/rive-format-and-graph.md` §6; independent player lifetime and optional renderer
boundaries follow `docs/research/rive-web-runtime.md`. No native source code is used.

## Diagnostics

| Code | Pointer | Condition and hint |
|---|---|---|
| `component-paint` | shape `/fill/paint` | Malformed source or competing color/type/ordered paints; use one `component:name` source. |
| `unknown-component` | shape `/fill/paint` | Source name absent; declare the component. |
| `undeclared-feature` | shape `/fill/paint` or registry-owned feature path | Missing components/paint/componentpaint; declare the required modules. |
| `component-cycle` | offending definition `/nodes/…/fill/paint` | Recursive source/depth16; remove recursion or reduce nesting. |
| `unsupported-render` | consuming shape `/fill/paint` | SVG source cannot be represented by that backend; use canvas. |

Other source validation diagnostics retain their original code, message and hint and name the
lexical `/components/name/…` location in the enclosing document. Source-order overrides apply
before the first step. Retired source/tree slots have no stale masks, clips or paints.

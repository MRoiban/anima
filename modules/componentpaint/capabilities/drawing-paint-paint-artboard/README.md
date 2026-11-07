# Live component paint

Implemented by modules/componentpaint/core and web. JSON `fill.paint: "component:row"` is AniML
`paint="component:row"`; see ../../README.md for semantics, diagnostics, backend restrictions
and dependency/size policy. Independent conformance covers 0/.5/1 seconds. Fresh native captures
and measured comparisons are in ../../oracle and ../../verification/native-metrics.json.
Parity status is intentionally unchanged. Central oracle manifest registration is parent-owned.

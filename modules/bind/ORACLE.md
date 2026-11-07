# String-function oracle disposition (P6-10)

`contains` and `lower` extend Anima's typed expression grammar; no parity inventory row is added
or closed. A raster oracle cannot establish argument typing, Unicode casing, empty-substring
behavior or same-step data evaluation. This ticket therefore uses independent scalar expectations
in `test/core/strings.test.ts` and six scripted snapshots in
`spec/conformance/bind-string-filter/`, plus both browser engines exercising the shipped bundle.
No new native raster case is claimed or added to the completed oracle manifest.

The native search-card benchmark at
`docs/benchmarks/runs/2026-11-08-p6/search-rive/` remains the behavior reference for the owner's
fresh AniML search-card rerun. This ticket does not edit benchmark sources/evidence or claim that
benchmark's remaining text-field commit/session issues are resolved. Existing strict raster oracles
are rerun unchanged as a regression check.

The shared evaluator and explicit load errors retain the single-pass and strict-reference choices
in [animation/state research](../../docs/research/rive-animation-and-state.md) §C. No Rive source,
documentation text or binary is used by this implementation.

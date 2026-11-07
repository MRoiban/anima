# a11y-inferred-text

Implemented by the optional text adapters, without new authoring keys. Normative behavior:
`modules/a11y/TEXT.md`. Diagnostics, both syntax spellings and geometry are exercised in
`modules/a11y/test/core/text-hit.test.ts`; host/listener/overlay behavior in both engines is
covered by `modules/a11y-dom/test/web/text-hit.test.ts`. The paired example compiles through
AniML and the corresponding conformance probe uses independent metric/input expectations.
See `modules/a11y/P6-7-REPORT.md` for verification and row disposition.

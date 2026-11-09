# P8-4 implementation report

- 2026-11-09 22:43: created branch `p8-4`, ran `npm ci`, and scaffolded `rigging.skin`, `rigging.weights`, and `rigging.cubic-weights` with `--module skin` after each required dry run. Parity rows remain planned; scaffold TODO probes are present.
- 2026-11-09 22:55: implemented the skin field model, explicit point/in/out influence maps, @rest, four-influence cap/normalization plumbing, automatic two-nearest rest-segment weights, rest-relative deformation, and derived skin.point values. Full typecheck passes.

# Vertex bone weights

Implemented inside `skin.weights`: one explicit entry per geometry point, up to four influences, normalized with `rig-weight-sum`, with `@rest` as identity. Omitting `weights` selects deterministic two-nearest-segment automatic weights. See `spec/conformance/rigging-weights`.

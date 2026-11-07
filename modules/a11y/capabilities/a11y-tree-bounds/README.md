# Semantic bounds — partial

`core/registry.ts` owns `a11y.bounds` in JSON and AniML. Explicit boxes and simple
painted group unions are tested by `test/core/a11y-tree-bounds.test.ts` and
`spec/conformance/a11y-tree-bounds`. The paired example is also in
`examples/painted-groups.animl`. The conformance expectation is calculated from the
three authored boxes, independently of the runtime.

This row remains planned: exact path/stroke extents and native comparison are missing.
A basic centered-stroke probe measured 2,104 / 2,048 B and was reverted at the fixed
guard. `tests/oracle/a11y-tree-bounds/todo.json` stays pending. See REPORT.md.

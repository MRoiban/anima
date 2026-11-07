# input.write-key-pressed

Implemented by `modules/input/core/registry.ts` (write/value in both syntaxes),
`core/index.ts` (typed writable-target diagnostics), and `core/runtime.ts` (event payload).
Independent expectations: `spec/conformance/input-write-key-pressed`.
Diagnostics and round-trip tests: `modules/input/test/core/data-writes.test.ts`.
Oracle: `tests/oracle/input-write-key-pressed` (native exact values, or evidenced skip).
The example is compiled through the AniML compiler. No placeholder registry entry is needed.

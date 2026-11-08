# Invalid option coverage

`../../text-variable-axes.test.ts` tests malformed four-character tags, nonnumeric axes,
negative and fractional features with exact diagnostic code/pointer/message assertions.
`options-conformance.test.ts` also tests unknown actual-font tags with repair hints.
No fabricated invalid font binary is used.

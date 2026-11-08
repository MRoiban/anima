This headless case projects the field value and focus used by the browser bridge.
It does not execute a DOM input, clipboard or accessibility proxy in Node.
The corresponding browser behavior is exercised in both engines by
`modules/text-input/test/web/field.browser.test.ts`; native headless API disposition
is recorded in `tests/oracle/text-input-clipboard/skip.json`.

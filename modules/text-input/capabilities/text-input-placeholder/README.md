# text-input-placeholder

`textInput.placeholderColor` (`<text-input placeholder-color="…"/>`) authors a distinct solid
placeholder paint. Without it, the field's ink draws at 50% opacity; caret/selection remain
undimmed. See `modules/text-input/SPEC.md`. The example uses the original generated font.

Tests: `test/core/text-input-placeholder.test.ts` (both spellings, errors, alpha and edit/clear),
`test/core/drawing-conformance.test.ts` (independent original-font conformance),
`test/cli/placeholder.test.ts` (tool/browser-text literal controls), and
`test/web/placeholder.browser.test.ts` (native edits with SVG/Canvas2D in both engines).

Parity remains planned: a faithful independent native placeholder comparison is missing.
The local native CLI schema search for placeholder has no matching type or property;
`TextInputPlaceholder` is unknown. This does not prove an absence in the native runtime.

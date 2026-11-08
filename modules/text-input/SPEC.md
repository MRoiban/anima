# DOM-backed text input (`textinput` feature, heavy `text-input` entry)

Import text, focus, a11y, a11y-actions and text-input browser entries. SVG selection/caret
drawing uses the optional text-input-svg entry; Canvas2D drawing uses text-input-canvas with
the canvas entry. Clipboard host helpers use text-input-clipboard. All four field entries are heavy.
Descriptor-only markup has its own markup-text-input authoring entry (with markup-text for runs/styles). A fixed-size text node with one literal run
accepts `textInput` (AniML `<text-input/>`). Its initial run is the default value; `writeText`
(`write-text`) optionally names a writable string input or data path. Fields infer a focus item
and their own text-field semantics; do not add an `a11y` object. The native field owns its label.

`editable` defaults true; false makes the field readonly. `multiline` selects textarea instead of
input. `obscured` masks the drawn value and uses a password input for single-line fields.
`placeholder` draws when empty. `placeholderColor` (`placeholder-color`) authors a separate solid
placeholder paint: a hexadecimal colour (3/4/6/8 digits) or `currentColor`. It replaces the run's
fill/stroke only while the value is empty. When omitted, the placeholder uses the field's normal
ink (including gradients, strokes, colour slots and authored alpha) at 50% opacity. This opacity
affects only glyphs; caret, selection and node opacity retain their normal values. Typing restores
the normal paint; clearing restores the placeholder. JSON and AniML use the same renderer-neutral
drawing data in tool SVG/outlines, browser SVG and Canvas2D. Invalid placeholder colours use the
registry diagnostic at `/nodes/<index>/textInput/placeholderColor`.
`maxLength` (`max-length`) counts UTF-16 code units as HTML does;
truncation drops a trailing high surrogate. `maxLines` (`max-lines`, multiline only) counts explicit
newline-delimited lines. CRLF/CR normalize to LF; single-line fields drop line separators.
`selectOnFocus` (`select-on-focus`) selects the entire native value on focus. Selection offsets
are UTF-16. `caretColor`, `selectionColor`, `selectionRadius` (`caret-color`, `selection-color`,
`selection-radius`) style the drawing overlay; the caret is steady and 0.06 grid units wide.

The browser handles clipboard, IME, dead keys and keyboard selection. The native text and native
caret are transparent. Selection and caret boxes use text layout clusters, and selection is drawn
behind text with optional rounded corners. Composition updates drawing but does not write data or
fire listeners until compositionend. A committed change queues write-text first, then `on="text"`
listener actions for the same field in declaration order, resolved on the next Player.step. Limits
are enforced for edits through the field API and headless commands as well as native edits.
As with HTML, direct model or initial-value assignment can exceed maxlength until the next edit. `textInput(id)` on the web host
returns the native element, including standard value/selection/clipboard event APIs. Assigning its
value requires an input event to commit. Browser clipboard permission remains the browser's policy.

Headless scripts focus a field with `focus target <id>` then `type "text"`, `compose "text"` or
`select <start> <end>`. Type replaces the current selection; compose simulates one completed IME
transaction (no intermediate committed writes). Semantic snapshots include text-field, value,
multiline, obscured, readonly, focused, label and transformed bounds. Obscured snapshots omit value.
The DOM field is the accessible textbox; its drawing SVG remains hidden from assistive technology.

Validation uses `text-input-config`, the precise offending JSON pointer, message and repair hint
for missing text/focus/a11y, unsupported runs, invalid boxes, duplicate semantic ownership, a line limit
on single-line fields, and invalid write targets. Registry validation handles types, whole limits
and nonnegative radii through the usual diagnostics. Both JSON and AniML spellings are normative.

Limits: one plain run per field; mixed-direction selection geometry needs further browser validation. The native field, not Anima, owns visual bidi navigation.
No native Rive equivalence is claimed. See docs/research/rive-web-runtime.md (host routing and
semantic proxies): Anima delegates editing to the DOM and does not copy that implementation.

`clipboardText(id, cut=false)` returns the native selected substring, or an empty string for
obscured fields. Cut removes the selection and commits through the same input event unless the
field is readonly. Native copy/cut on obscured inputs is prevented without stopping propagation.
Multiline obscured fields are rejected (`text-input-config` at `/textInput/obscured`): HTML has no
password textarea, and exposing its raw value as an accessible multiline textbox would leak it.

For substring search, see `anima docs bind`, "Filtering a list by typed text".
The complete `modules/bind/examples/filtering-list.animl` recipe uses
`contains(lower($label0), lower($query))` for case-insensitive matching, with an empty query
showing all rows and a derived result count. Validate it with
`anima validate modules/bind/examples/filtering-list.animl`; sample it with
`anima sample modules/bind/examples/filtering-list.animl --font sans-serif=fixtures/fonts/anima-test.ttf`.
The older `modules/text-input/examples/search-card.animl` demonstrates exact-label equality;
use the bind recipe for substring filtering.
Browser clipboard grants, mobile keyboard and real OS IME sessions are outside the automated proof.
Nested/repeated native field mounting, scroll-to-caret and mixed-direction selection geometry are
not yet implemented. Those limits block full parity closure.

Caret and selection colors accept hexadecimal colors (3/4/6/8 digits) or currentColor; other paints are rejected by registry validation. Font shorthand is assigned through its CSS property setter rather than interpolated into a style declaration list.

### Commit scheduling (P6-9b)

A native input/composition-end commit and the headless `type`/`compose` commands queue the
source write and committed-text listeners before the next `Player.step`. That single step
applies the source write, derives computed properties before guards, then resolves visual bindings.
There is no additional field-specific settling step: count, visibility and guard state agree with
the new source in the first completed step, just as for a queued host `set`. A host inspecting
the player immediately after dispatching a DOM input event must allow that scheduled step to run;
`icon.invalidate()` draws without consuming queued writes. `input-write-text` conformance checks
nonempty, cleared and external writes against derived counts, opacity and a machine guard.

### Native comparison disposition (P6-9b)

Original-font native captures compare the independent text layer, bound field values, explicit
multiline content and obscured content. The fixture does not contain U+2022, so the obscured
probe deliberately compares missing-glyph outlines; it does not certify a particular dot design.
Caret width remains Anima's steady 0.06 grid units. Selection uses SVG rx (or the equivalent
canvas rounded rectangle) over logical cluster intervals; the native capture's caret coverage
and selection rounding differ. Those drawable comparisons remain pending with no passing
budget. P7-8 adds selected-text color and reusable style paint references; see below.

IME, DOM host handles, clipboard routing and native field accessibility use the browser contract
rather than a native window proxy. The permitted headless native command route rejects text,
compose and clipboard delivery; its semantic JSON is not a browser DOM accessibility tree.
Row-specific `tests/oracle/*/skip.json` files link the attempted commands and both-engine tests.
These skips do not certify actual OS IME sessions, clipboard grants, mobile keyboards or
screen-reader announcements. Four conformance cases project the field state used by these
DOM APIs; their README files explicitly distinguish that projection from executing a DOM API in Node.

### P7 comparison boundaries

The caret deliberately remains a steady **0.06 grid units**, transformed like the text, rather
than a capture-pixel hairline. Core drawing has no host pixel ratio or viewport, and this choice
keeps headless, SVG and canvas geometry consistent. The native probe draws a 1-pixel caret even
with scaleX 0.72; that difference is retained, not covered by an antialiasing tolerance.

Edit limits deliberately follow HTML UTF-16 maxlength and explicit paragraph counts. Wrapped-line
limits would change accepted input when a host resizes or a font loads; Anima does not make stored
input validity depend on those events. The native schema uses scalar counts and displayed lines.
The local headless route cannot deliver native text-edit transactions, so it cannot faithfully
compare that alternative. Existing surrogate, newline, composition and direct-write regressions
specify Anima's contract. A direct data write or initial value can exceed limits until an edit.

The local native TextInput authoring surface rejects placeholder and placeholderColor (see
`tests/oracle/text-input-placeholder/rive/verify.txt`). A static label cannot prove placeholder
switching or independent paint. This row uses an evidenced native-observation skip plus original-
font conformance and both-engine SVG/canvas regressions, not a substitute static-text comparison.

Selection rounding is intentionally the SVG/canvas rounded rectangle of each selected line:
use the authored radius (default zero), with the renderer's half-extent clamp. Native authored
radii 0 and 2.4 retain identical rounding in the captured controls; Anima honors its radius rather
than emulating that observation. This keeps line metrics, selected logical clusters and drawing
consistent in both backends. Select-on-focus selects the full value; its native capture already
confirms the interaction. Its remaining pixel difference shares this documented geometry choice.
P7-8 adds separate selected paint and reusable text-style paint references, specified below.

### Separate selected text paint (P7-8)

`selectedTextColor` (`selected-text-color`) is an optional hexadecimal/currentColor paint for
selected glyphs, independent of the `selectionColor` background. Omission keeps normal text ink.
While focused with a nonempty value and selection, intersecting grapheme clusters receive the
selected fill in shared draw data; nonselected clusters keep their original fill/stroke. The
selected fill replaces the original stroke. Collapsing the selection, blurring, or clearing the
value restores normal ink. The cached measured layout is not mutated. SVG and canvas consume
the same split paint runs. Registry errors use `/nodes/N/textInput/selectedTextColor`.

Paint boundaries follow grapheme clusters. As with the existing run renderer, a font's ligatures
across different paint runs may be reshaped; no fractional-glyph painting is implied. `selectedTextStyle` (`selected-text-style`) optionally names a local or shared text style whose
fill/stroke paints replace selected ink, including gradients and color slots. Only its paints are
used: font, size, axes and metrics stay those of the original text. A missing style produces
`text-input-config` with a precise field pointer and repair hint. A color, when both are supplied,
overrides the style. Styles with no paint make selected glyphs transparent. This reuses declared
text styles rather than a reference to a rendered scene node. Both backends consume the same
resolved fill/stroke; no special selected-font layout is introduced.

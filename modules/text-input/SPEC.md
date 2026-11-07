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
`placeholder` draws when empty. `maxLength` (`max-length`) counts UTF-16 code units as HTML does;
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

The search-card example uses exact-label equality (empty query shows all five labels). It uses
existing derived numeric booleans, collapsed bindings and a template converter for the count.
CLI proof: `anima sample modules/text-input/examples/search-card.animl --font
sans-serif=fixtures/fonts/anima-test.ttf --script modules/text-input/examples/search.txt`.
Browser clipboard grants, mobile keyboard and real OS IME sessions are outside the automated proof.
Nested/repeated native field mounting, scroll-to-caret and mixed-direction selection geometry are
not yet implemented. Those limits block full parity closure.

Caret and selection colors accept hexadecimal colors (3/4/6/8 digits) or currentColor; other paints are rejected by registry validation. Font shorthand is assigned through its CSS property setter rather than interpolated into a style declaration list.

# Search card benchmark

The visible scene is RML. `controller.luau` computes filtering and count and
handles focused keyboard/text events; it draws nothing. The only font is the
brief's original geometric test font, copied unchanged.

Reproduce from this folder:

```sh
python generate.py
~/.rive/bin/rive . --verify
~/.rive/bin/rive inspect . --json
~/.rive/bin/rive . --commands=commands.txt
python assert-evidence.py
```

Capture output paths are relative to the shell's current directory. Commands
use the real focused keyboard dispatch: `key o`, Backspace, `key s`, `key o`,
Backspace twice. The final capture also checks uppercase `SO`, a host write to
`query`, and a literal punctuation query. Renaming uses `data label3=Audio settings`.

`evidence/capture-06.txt` is the final capture run; matching JSON and PNG files
are directly in `evidence/`. Earlier process logs remain numbered; `attempt-03/`
preserves the first successfully written captures whose typing did not work.
`evidence/errors.txt` counts failures, including documentation lookup misses.
`assert-evidence.py` checks exact independent expected rows, values, counts,
hidden/opacity data, and final inspect diagnostics.

The font intentionally makes letters geometric. Screenshots prove motion and
layout, while JSON trees preserve readable full labels. Row text uses native
fixed-size, no-wrap, ellipsis overflow; accessible names keep the full strings.
The field is a custom focused text editor: appending letters/digits/punctuation,
Backspace, and Escape are supported. It has no caret, selection, IME integration,
or OS text-input bridge in this benchmark. Its semantics field has no measured
bounds in the CLI tree. Only the local headless interface was tested.

Local documentation consulted through `rive docs`: format, text, data,
semantics, skeleton, focus, gotchas, luau/protocols, luau/api/interfaces, and
luau/api/artboards. Schema queries covered TextInput, TextInputText, SemanticData,
SolidColor, KeyboardInput, ScriptedLayout, LayoutComponent, LayoutComponentStyle,
and DataBindContext. No CLI sample or account operation was used; no Rive
source, CLI implementation, or .riv was read.

Local run ledger. First command: 2026-11-08T12:15:12Z (UTC). CLI log timestamps use local CET (+01:00).

| Kind              | Runs  | Notes                                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify            | 01–05 | All returned 0 errors, 0 warnings. 03 compiled an unattached script after a helper edit failed. 05 checks final sources.                                                                                                                                                                                                                                      |
| inspect           | 01–03 | All have `problems: []`. 03 is final.                                                                                                                                                                                                                                                                                                                         |
| headless commands | 01–08 | 01 queried command help; 02 native layout interpolation; 03 computed-width experiment collapsed to 24 px; 04 added unbounded measurement; 05 repeated 04 after helper edit failed; 06 script controller; 07 repeated 06 after command-generation paths failed; 08 final portable proof. All builds reported 0 errors, 0 warnings; no `err` command responses. |

Total: 16 CLI verify/inspect/capture invocations. Each commands invocation builds once. Screenshot, semantic and data-dump commands within those sessions are not additional CLI invocations. Final `proof.commands` contains the complete capture sequence. `capture-08.txt` records every response. Files with `growth`, `shrink`, `interrupted-growth`, `interrupted-shrink`, `reversal`, `contain`, `layout`, `title-updated` prefixes, plus baseline/chip samples, are the final evidence. Earlier descriptive sample names and `native/` are exploratory evidence.

Errors observed outside those build checks (5 occurrences):

1. Docs lookup: `no topic "luau/api/context". Try rive docs --list.` (1). Read `luau/api/interfaces` instead.
2. Exploratory Python geometry printer: `TypeError: 'NoneType' object is not subscriptable` (1). Collapsed experiment produced a null text bound.
3. Python edit: `ValueError: substring not found` (1). Replacement expected two leading spaces absent from the file; corrected the match.
4. Shell redirection: `docs/benchmarks/runs/2026-11-08-p7/rive/make_proof.py: No such file or directory` (1). Already in that directory.
5. Python invocation: `can't open file .../rive/docs/benchmarks/runs/2026-11-08-p7/rive/make_proof.py: [Errno 2] No such file or directory` (1). Corrected both paths to local names.

Behavioral failures, not diagnostic errors: native layout interpolation and `DataConverterInterpolator` both restarted from the earlier endpoint on interruption. The first computed-width experiment returned width 0 until `hugUnbounded` was set. These were corrected; final geometry assertions pass. EGL's `no interlock mode supports this frame, drawing it in depthStencil with 4x MSAA` is a renderer fallback notice, not a failure.

Replay from this folder:

```sh
python make_proof.py
~/.rive/bin/rive . --verify
~/.rive/bin/rive inspect . > evidence/inspect-03.json
~/.rive/bin/rive . --commands=proof.commands > evidence/capture-08.txt 2>&1
python check_evidence.py
```

The bundled font is an unmodified copy of the specifically permitted `fixtures/fonts/anima-test.ttf`; its geometric glyphs are intentional. Markup owns all visible elements, layout and measurement; `width-motion.luau` only smooths the numeric width. `buttonTextWidth` and `buttonWidth` are telemetry/controller data; host inputs are `title`, `buttonLabel`, `chip1Label`, `chip2Label`, `chip3Label`, `hideChip3`.

The data command consumes one simulation frame. A retarget therefore includes one final old-direction step before the updated text measurement reaches the controller; the next 18 frames interpolate from that current width. Final per-frame bounds show no restart jump, with a maximum step of 4.8006 px. Bounds are artboard coordinates; in contain mode the 480 × 360 artboard is unchanged while the PNG dimensions match the host. Layout mode changes the actual card bounds.

# P4e-2 integration handoff

Implemented: all §5 converter names, pure registry `(value, options, ctx) => value`, group runner,
math-call compiler/registration adapter, player-keyed deterministic random and interpolation,
JSON registry/schema loading, AniML converter/group round trips, example, diagnostics, 35 observed
Rive output comparisons. No runtime dependencies or shared handwritten implementation edits.

Data integration must:

- Read `convert.converterRegistry` or call `convert.createConverterRunner` from the active runtime
  module map (separately bundled entries must share registry identity).
- Pass actual player object, absolute millisecond clock, seed and binding identity as context;
  call each binding once per evaluation. Wake until interpolation finishes; always-random bindings
  need an explicitly chosen evaluation schedule. Once/on-change random cache by source input.
- Resolve `$` operands before calling formula; the current formula accepts named numeric/bool scope
  entries and `value`, with the base bind grammar. The planned `$` lexer hook is not in this checkout.
- Register the exported math descriptors with bind's upcoming function hook. Random additionally
  needs `seededRandom(ctx, mode, incomingValue, siteId)`, not Math.random or a model-global closure.
- Compose `convertMarkup.rootChild` and converter decompiler definitions in the generic data hook,
  replacing this checkout's guarded tooling composition into the existing events compiler object.
  Browser `markup-convert` currently registers the composed events slot; integration must preserve
  that behavior or replace it consistently.
- Connect named binding `convert="..."`, reverse direction, trigger counter delivery, default model
  instance creation/list retention. No replacement binding protocol was introduced here.
- Replace 66 canonical conformance and oracle todo probes with actual Player-step scripts and
  independent expectations. Unit input/output and temporal tables are already real tests; these
  do not masquerade as completed canonical probes. Match raw Rive observations under oracle/.

Parity: 79 requested rows, of which 13 already done at the starting commit. No new row is promoted
as strictly done in this isolated checkout. P9 owns scripted converters. Other broader gaps:
range/interpolation easing, HSL format markers, named/sequential template arguments, reverse system
unit conversion, template padding, model instance list identity. §5 positional templates, numeric
precision/grouping, fixed unit conversion and index-list construction are implemented.

Verification commands and final measured sizes are recorded in WORKLOG.md and the final report.

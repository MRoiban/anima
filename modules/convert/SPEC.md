# convert

Optional feature `convert`, after `bind`; no runtime dependencies. JSON declarations are a
`converters` map at the document root. Each value is `{type, ...options}` or `{chain: [names...]}`.
Names in a group execute left to right; forward references are permitted, cycles and missing
references are errors. A group occurrence has its own state key, including repeated names.

The integration API is `converterRegistry: Map<string, (value, options, ctx) => value>` and
`createConverterRunner(definitions)(name, value, ctx)`. Context contains `player` (stable object),
`time` (absolute milliseconds), `seed` (uint32, default 1), `key` (binding identity) and optionally
`values` (numeric/boolean formula variables). The data module owns scheduling and supplies context.
The runner extends the key with the group occurrence path. Direct calls to a stateful converter
must supply a stable context. No state is stored on the loaded model or shared between players.

| Type | Options and semantics |
| --- | --- |
| formula | `expression`, `random`: always (default), once, on-change. Variable `value` is the input. |
| calculate | `operation`, numeric `operand` (default 1); arithmetic and registered math operations. |
| range | `from` and `to` number pairs (default 0 1); map linearly. `modulo`, then `clamp`, then `reverse` apply to normalized progress. Reversed endpoints are permitted; zero-width source is invalid. |
| round | `decimals` (0–100, default 0), `mode`: round/floor/ceil; ECMAScript rounding semantics. |
| negate | Boolean inversion; numeric inputs are errors. |
| to-number | Number, boolean or string conversion using ECMAScript Number; nonnumeric strings become zero. |
| to-string | ECMAScript String conversion. |
| number-format | `decimals` (0–100, default 0), `grouping` boolean; fixed precision, dot decimal, comma thousands; locale independent. |
| color-format | Hex colour or 4-channel RGBA tuple → `format` hex/hexa/rgb/rgba (default hex). |
| pad | String `length` (0–10000), `fill` (nonempty string, default space), `side` start/end. UTF-16 length. |
| trim | `mode`: start/end/all/none; ECMAScript whitespace. |
| template | `text`, `open`/`close` delimiters (default braces), `grouping`; scalar input is argument 0, list is positional arguments. `{0:2}` fixes two decimal places. No implicit model resolution. Missing arguments are errors. |
| remove-zeros | Strip redundant fractional zeros and empty decimal point; integer zeros remain. |
| enum-to-index | `values`: ordered strings. Unknown values are errors. |
| list-length | Return list length. |
| number-to-list | Integer count 0–10000; produce index values or repeated `item`. Model instance creation awaits data integration. |
| trigger | Boolean pulse passthrough or truncated integer signal counter. Counter-to-trigger delivery awaits data integration. |
| degrees-to-radians | Multiply by pi/180. |
| normalize | Normalize using `from` pair, default 0 1; no implicit clamp. |
| interpolate | `duration` in milliseconds, default 0. First evaluation returns input immediately; changes retarget from the current sample. Linear numeric or rounded RGBA channel interpolation. No extrapolation before start or after completion. |

Expressions reuse bind precedence, token/depth limits, numeric/bool coercion and non-finite-to-zero
rules without eval or dynamic code generation. Added calls: sin/cos/tan/asin/acos/atan/atan2,
log (natural), exp, pow, sqrt, round, ceil, floor, abs, random(). Long aliases sine/cosine/tangent,
asine/acosine/atangent/atangent2/power/squareRoot are accepted. Radians for trig. Existing
min/max/clamp/mix/mod remain available. `registerMathFunctions(register)` exposes names, arities
and pure evaluators for the bind registration seam. Random is context-dependent, not a pure math
registration: formula owns it. Random uses independently implemented uint32 LCG
`seed = (1664525 * seed + 1013904223) mod 2^32`, output seed/2^32; sites and bindings cache separately.
`always` advances on evaluation, `once` caches per site, `on-change` invalidates when the incoming
value changes under Object.is. Repeated evaluation of unchanged input retains the cached value.

Diagnostics: `convert-unknown-type`, `convert-options`, `convert-type`, `convert-cycle`,
`convert-reference`; formula errors retain bind codes. Load-time diagnostics point at
`/converters/<escaped-name>/<option>` where possible and include message and hint.
`ConverterError` carries code and option for the data integration to attach a binding pointer.

AniML adapter: `convertMarkup.rootChild` accepts `<converter name="pct" type="range" from="0 1"
to="0 100"/>` and `<converter-group name="fmt" chain="pct round label"/>`.
The temporary tooling adapter composes these forms and decompiler definitions into the existing
events compiler object. Browser registration installs the composed object under the events slot.
This guarded composition does not enter the base browser compiler. Replace it with the generic
data hook at integration. Both forms round-trip through the normal compiler/decompiler.
JSON converter declarations validate and appear in generated schema/CLI.

Scope limits: named `convert` bindings, `$` formula operands, scheduling,
and host integration await the data module. Scripted converter execution belongs to P9 (sandboxed
scripting), not this module. Color HSL markers, direction-aware reverse conversion, easing on
interpolation/range, model instance list retention, and named/sequential template args remain
parity gaps; current behavior must not be promoted as equivalent for those broader rows.

Algorithms are independently implemented from standard arithmetic and ECMAScript functions.
No Rive source or .riv files were read; no CLI documentation text was copied. The registry design follows
the metadata rationale in `docs/research/rive-format-and-graph.md`; this is not a Rive algorithm port.

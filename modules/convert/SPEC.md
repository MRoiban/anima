# convert

Authoring: [Data: view models, `$` paths and converters](../../docs/AUTHORING.md#data-view-models--paths-and-converters).

Optional feature `convert`, after `bind` and `data`; no runtime dependencies. JSON declarations are a
`converters` map at the document root. Each value is `{type, ...options}` or `{chain: [names...]}`.
Names in a group execute left to right; forward references are permitted, cycles and missing
references are errors. A group occurrence has its own state key, including repeated names.

Named converters/groups register through the active data module’s `registerConverter(name, fn)`;
`fn(value, options, ctx)` receives `{player, dt, direction, get, state, key}`. Definitions are selected
from that player’s document, so equal names in different documents remain independent. Bindings
require `data` and `convert`. Binding `options` override declaration options; whole `$path` strings
resolve from the player’s current data scope. Formula `$` operands use the same resolver and bind
parser. Unknown named converters and invalid numeric operand paths fail at load with pointers.

`ctx.state` is a shared player-local Map. Convert namespaces a separate map per stable binding
`key` inside it, preserving external converters’ access to the shared map. Interpolation state is stored only
there, keyed by group occurrence and direction, including repeated converter names. No state is
stored on a loaded model or shared between players. The direct API `convertValue` and
`createConverterRunner` accept `{player,time,state,key?,get?,direction?}`; `time` is milliseconds
and direct temporal calls retain their context map. The runtime supplies `player.time * 1000`.
Converter-free documents install no scheduler wrappers. Active interpolation and `random="always"`
keep the player unsettled; `once`, `on-change`, and completed interpolation allow sleep.
Bindings evaluate once per data binding evaluation; `mode="once"` retains its converted output.

| Type | Options and semantics |
| --- | --- |
| formula | `expression`, `random`: always (default), once, on-change. Variable `value` is the input. |
| calculate | `operation`, numeric `operand` (default 1); arithmetic and registered math operations. |
| range | `from` and `to` number pairs (default 0 1); map linearly. `modulo`, then `clamp`, then `reverse` apply to normalized progress. Reversed endpoints are permitted; zero-width source is invalid. Optional `ease` uses the existing timeline easing grammar (default linear). |
| round | `decimals` (0–100, default 0), `mode`: round/floor/ceil; ECMAScript rounding semantics. |
| negate | Boolean inversion; numeric inputs are errors. |
| to-number | Number, boolean or string conversion using ECMAScript Number; nonnumeric strings become zero. |
| to-string | ECMAScript String conversion. |
| number-format | `decimals` (0–100, default 0), `grouping` boolean; fixed precision, dot decimal, comma thousands; locale independent. |
| color-format | Hex colour or RGBA tuple → `format` hex/hexa/rgb/rgba (default hex), or component `pattern` (see below). |
| pad | String `length` (0–10000), `fill` (nonempty string, default space), `side` start/end. UTF-16 length. |
| trim | `mode`: start/end/all/none; ECMAScript whitespace. |
| template | `text`, `open`/`close` delimiters (default braces), `grouping`, optional `args` map/array. Without `args`, scalar input is argument 0 and a list supplies positional arguments. Named keys, numeric positions and sequential `{}` placeholders are supported. `args` values may be `$` paths. `{points:2:8}` fixes two decimals and left-pads to width 8 (maximum 10000). Missing arguments are errors. |
| remove-zeros | Strip redundant fractional zeros and empty decimal point; integer zeros remain. |
| enum-to-index | `values`: ordered strings. Unknown values are errors. |
| list-length | Return list length. |
| number-to-list | Integer count 0–10000; produce index values or repeated `item`. Model instance creation awaits data integration. |
| trigger | Boolean passthrough or truncated integer counter; a trigger binding destination fires when the converted output changes (next step, no initial pulse). |
| degrees-to-radians | Multiply by pi/180 forward; by 180/pi in reverse. |
| normalize | Normalize using `from` pair, default 0 1; reverse denormalizes with the same pair. No implicit clamp. |
| interpolate | `duration` in milliseconds, default 0. First evaluation returns input immediately; changes retarget from the current sample. Numeric or rounded RGBA channel interpolation; optional `ease` uses the existing timeline easing grammar (default linear). No extrapolation before start or after completion. |

Expressions reuse bind precedence, token/depth limits, numeric/bool coercion and non-finite-to-zero
rules without eval or dynamic code generation. Added calls: sin/cos/tan/asin/acos/atan/atan2,
log (natural), exp, pow, sqrt, round, ceil, floor, abs, random(). Long aliases sine/cosine/tangent,
asine/acosine/atangent/atangent2/power/squareRoot are accepted. Radians for trig. Existing
min/max/clamp/mix/mod remain available. All math functions, including random(), register through the active bind module’s
`registerFunction(name,arity,fn)` and formulas compile with its `parse` hook. There is no second
expression parser. Random is evaluated within the formula context; unscoped random calls outside
a formula return zero. Math functions are available to ordinary bindings whenever convert is
installed. Random uses independently implemented uint32 LCG
`seed = (1664525 * seed + 1013904223) mod 2^32`, output seed/2^32; the stream is shared per player in authored evaluation order, while sites/bindings cache separately.
`always` advances on evaluation, `once` caches per site, `on-change` invalidates when the incoming
value changes under Object.is. Repeated evaluation of unchanged input retains the cached value.

Diagnostics: `convert-unknown-type`, `convert-options`, `convert-type`, `convert-cycle`,
`convert-reference`; formula errors retain bind codes. Load-time diagnostics point at
`/converters/<escaped-name>/<option>` where possible and include message and hint.
`ConverterError` carries code and option for the data integration to attach a binding pointer.

AniML adapter: `convertMarkup.rootChild` accepts `<converter name="pct" type="range" from="0 1"
to="0 100"/>` and `<converter-group name="fmt" chain="pct round label"/>`.
The generated `convertCompiler` hook supplies declaration compilation/decompilation independently
of events/data authoring. Browser `markup-convert` registers the `convert` slot. JSON declarations,
AniML, CLI schema/inspect and `anima docs convert` use the same metadata and module chapter.

Remaining parity limits: retained model-instance list creation; scripted conversion (P9). Their canonical
probes retain precise `todo.json` reasons. Existing scalar/index-list/boolean conversion functions
are useful independently but do not complete those broader rows. See ROWS.json and REPORT.md.

### Intentional differences and observation limits

These decisions retain the original oracle findings unchanged; none becomes a passing comparison.

- Boolean → string uses ECMAScript `"true"`/`"false"`, rather than the native numeric spelling
  (`"1"` for true). See [boolean text finding](../../tests/oracle/data-converter-to-string/finding.json).
- Interpolation initializes eagerly from the value at load. A later source change interpolates from
  that value rather than snapping on the first non-default change as native does. See
  [number interpolation finding](../../tests/oracle/data-interpolate-number/finding.json).
  RGBA channels round half up, so a black/white midpoint is `#808080`, rather than native `#7f7f7f`;
  see [colour interpolation finding](../../tests/oracle/data-interpolate-color/finding.json).
- Decimal rounding and degrees → radians retain doubles. Their measured differences are solely
  native float32 storage precision, not different arithmetic contracts. See
  [decimal rounder finding](../../tests/oracle/data-converter-rounder/finding.json) and
  [degrees → radians finding](../../tests/oracle/data-converter-system-degs-to-rads/finding.json).
- Enum → index returns the declared zero-based index. The native dump's unchanged numeric bridge
  is an observation limit, not evidence of a different enum conversion rule. See
  [enum observation finding](../../tests/oracle/data-converter-enum-to-uint/finding.json).

Algorithms are independently implemented from standard arithmetic and ECMAScript functions.
No Rive source or .riv files were read; no CLI documentation text was copied. The registry design follows
the metadata rationale in `docs/research/rive-format-and-graph.md`; this is not a Rive algorithm port.


### Colour component patterns

JSON `pattern: "{h} {s}% {l}%"` / AniML `pattern="{h} {s}% {l}%"` on a `color-format`
converter overrides `format`. `{r} {g} {b} {a}` are rounded RGBA bytes (0–255); `{h}` is
rounded hue in degrees, 0 for achromatic colours, `{s}` and `{l}` are rounded HSL percentages.
RGB normalizes to [0,1]; lightness is (max+min)/2, saturation is delta/(1−|2L−1|),
with zero saturation when delta is zero. Hue follows the standard six-sector RGB definition.
`{hex}` is lowercase `#rrggbb`. Other text is copied literally; unknown brace markers report
`convert-options` at `/converters/<name>/pattern` with a correction hint. Alpha does not
affect HSL, and no locale affects component formatting. Native `%r`/`%g`/`%b`/`%a`/`%h`/`%s`/`%l`
captures are compared exactly in module-owned oracle tests; native docs text is not copied.

### Repeated players

Converter definitions belong to the compiled document, including players whose model is
cloned for repeated rows. Each row still uses its own player random source and binding-local
state; sharing definitions does not share interpolation or once/on-change caches. This keeps
the model/runtime separation described in `docs/research/rive-format-and-graph.md`.


### Animate a bound position

Use the existing `interpolate` converter for a travelling indicator; its `duration` is
milliseconds and `ease` uses the timeline easing grammar:

```xml
<anima version="0.1" name="travelling-indicator" grid="120" requires="data bind convert">
  <model name="Position"><number name="x"/></model>
  <converter name="travel" type="interpolate" duration="200" ease="cubic(0.42, 0, 1, 1)"/>
  <circle id="indicator" cx="10" cy="10" r="3" fill="#4263eb"/>
  <bind target="indicator.x" value="$x" convert="travel"/>
</anima>
```

Sample the initial state (`advance 0`), then `set $x 100`, `advance 0`, and
`advance 0.1`: x is about 31.5357. Another 0.1 seconds reaches 100. In a browser,
set the typed number/path and let the player's ordinary frame loop advance the converter.
Retargeting begins at the current sample; no page-side interpolation is needed. The first
binding evaluation initializes immediately. Timelines use seconds; converter duration uses ms.

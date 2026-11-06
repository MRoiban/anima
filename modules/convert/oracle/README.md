# Converter value observations

Independently authored RML; no Rive source or documentation text copied. Captured with the local
CLI on 2026-11-06 using only schema/docs queries and headless commands. No .riv was read or written.

From the repository root:

```
~/.rive/bin/rive modules/convert/oracle/rive --commands=modules/convert/oracle/capture.commands
```

The event's custom properties are observation bridges: forward bind applies the converter;
reverse bind exposes the result in a model property for `data-dump`. No pointer dispatch is needed.
Build: 4516 bytes in memory, zero errors/warnings. `observed.json` is the unedited CLI dump.
`inputs.json` declares independent source values and Anima equivalents. Unit tests compare 35
observations; numeric comparisons use five decimal places because Rive's dump observes float32
values. Existing oracle tolerances and measuring tools are unchanged.

Observed: all 19 arithmetic operations, range map/modulo/reverse/lower+upper clamp, decimal round,
four trim modes, both padding sides, zero removal, boolean inversion, fixed number formatting,
string-to-number conversion. No canonical oracle manifest entry is claimed: the data merge must
supply corresponding Player-step probes. Remaining rows retain pending probes rather than false
skip notes. Enum/list/template/time-dependent/seeded-random behavior has direct independent Anima
tables but has not been captured from Rive here. Anima's seeded random sequence is intentional,
so byte-for-byte random samples are not a faithful Rive oracle counterpart. Scripted converters
are deferred to P9; model operand resolution belongs to the data merge.

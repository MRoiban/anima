# STATUS / VERIFY / METRIC / DEVIATIONS / PROBLEMS

STATUS: resolved `data-bind-listener-actions` pending probe and added three more
completed comparative probes. Local commit only; no push, PR or merge.

VERIFY: `npm run test:scope -- bind events oracle`: **876 passed, 87 skipped**,
15 files; skips are the conformance cases excluded by the requested scope, not
pending oracles. Bind/events browser suites are included. `npx prettier --check .`,
`npx eslint .`, `npx tsc -p tools`, `node tools/modules.ts --check`,
`node tools/parity.ts --check`, `git diff --check`: exit 0.
`node tools/oracle.ts --strict`: exit 0. Tools installed with `npm ci`.
Full CI was not run or claimed.

METRIC: **4/4 completed post-click probes**, **104/104 exact observations**, tolerance
**0**, **30 ordered events** (25 shared plus 5 modulo-gated). Clamp saturates at 7
through click 25. New-count fields are 1–25 and 5/10/15/20/25 respectively.
The complete oracle set has 45 cases; three findings remain separate. Parity test
fields updated for `data.bind-listener-actions` and `events.payload-number`;
row statuses unchanged.

DEVIATIONS: comparisons use explicitly indexed post-click observations. Rive runs
one extra native frame after each click; no elapsed-frame parity is claimed.
Rive event fields are observed through outward bindings of the actual custom number
property into a data dump; event logs supply names/order but omit payloads. This
compares the property at the dump boundary, not a host callback's payload. No new
skip, runtime/spec change, tolerance change, account operation or .riv read.

PROBLEMS / numbered findings:

1. Immediate modulo probe: Anima has **5** events at clicks **5/10/15/20/25**;
   Rive has **4** at **6/11/16/21**, with observed fields **6/11/16/21**. Four
   corresponding reports lag one click and the fifth is absent. Retained as a
   tested finding, excluded from completed parity. The extra-frame capture matches.
2. Inherited event-listener response: Anima frames **14/29**, Rive **13/28**,
   sources **13/28** in both. Intentional next-step rule, **+1 frame**.
3. Inherited last timeline key: Anima **60**, Rive **61**, with earlier keys
   **15/30** in both. **1 frame** difference, cause unproven.

Reproduction, exact mappings, native commands, raw dumps, event logs and finding
references: [ACTION-EXPRESSIONS.md](../../tests/oracle/ACTION-EXPRESSIONS.md).
Initial exploratory capture used a wrong working directory and could not write
frame dumps; rerunning inside the project fixed it. An immediate modulo capture
revealed finding 1; it was retained, not removed by relaxing the comparison.

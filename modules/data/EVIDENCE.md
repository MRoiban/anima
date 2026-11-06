# Data evidence provenance

`generate-evidence.ts` authors the sixty row vectors without importing Player or runScript.
It compiles only the document spelling. Scalar expectations are literal values, references preserve
named identity, and mode expectations follow the conflict rules in SPEC.md. For example, a linear
1→11 target is 6 at half duration; simultaneous source 8 wins in source-preferred two-way mode,
and the target reaches 11 at the final frame. A red channel of 40 on black yields `#280000`.
System-enum endpoints are declared independently in the generator from the normative vocabulary
in SPEC.md; they are not read from `core/enums.ts` or Anima output.

The three module-local vectors are also hand authored: a stateful converter adds successive
counts to 2 (3, then 4); a child reverse write changes shared value 3→1 before the parent's
listener queues count 0→1 on the following step; a state-entry trigger queues listener value
0→9 on the following step. These cover converter state and after-child listener ordering.
The internal-trigger native difference is preserved rather than used as a passing comparison.

`build-oracle.ts` normalizes independently captured native JSON dumps into observation references.
It changes color spelling (ARGB to RGBA) and path names, not values. It does not import an Anima
player. Native commands, scenes, sessions and raw captures are retained beside each case.
The two exact trigger-flag comparisons live in the module's `oracle.test.ts` and `oracle/signals.json`;
the shared oracle tool is unchanged. The other 37 new comparisons use its existing observation path.
System-enum and asset-reference CLI observation limits retain evidence in 21 skip records.

Browser checks build separate runtime, markup, bind and data bundles, exercise both arrival orders
in Chromium and Firefox, then check named/default instance aliases, string custom properties,
registered math/converter hooks (3×4+5=17 and 3×8+5=29) and foreign-parser error diagnostics.
No browser download, server, external request or Rive file conversion is involved.

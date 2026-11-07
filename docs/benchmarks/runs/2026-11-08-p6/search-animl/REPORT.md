Format: AniML, with a JavaScript host filtering helper.

Wall time (first command to done): approximately 7 minutes (first command 2026-11-07 22:44:41 UTC; includes dependency installation, evidence and commit).

Check/validate/build/render runs: 38 scene-tool invocations: 3 validate, 3 build, 5 render, 26 sample, 1 session. Errors seen: missing CLI dependencies ×1 (initial help, exit 2); `bad-name` ×1; `script-usage` ×1 containing `text-measurer`; host-harness `AssertionError` ×1 wrapping that session failure. Final validation and all subsequent samples/builds/renders succeeded. Formatting commands are excluded from scene-tool counts. See `evidence/commands.jsonl`, `evidence/bootstrap.txt` and `evidence/session-failed.json`.

Source size: AniML: 46 lines, 3,701 characters. Authored helper sources: 142 lines, 8,428 characters. Total: 188 lines, 12,129 characters; excludes compiled ANI, generated interaction script, evidence and this report.

Brief items met (1–6), each with how you checked it:

1. Met: `evidence/wave.png` contains seven rendered frames from 0 to 1.2 seconds. Letters rise from one unit below and fade in sequentially; the timeline finishes at 1.1 seconds.
2. Met: named `$label0`–`$label4` strings drive text. `evidence/captures.json` records full semantic labels before/after renaming. `evidence/svg-assertions.json` verifies long labels end in ellipses and a data-only rename changes the rendered text from Privacy to Audio. Boxes are 14 × 2.5 units with 1.8-unit text.
3. Host-assisted approximation: actual CLI `type`, `select` and `advance` commands update `$query`. `filter.mjs` computes case-insensitive substring matches from live query/label data, then the proof harness writes `$shown0`–`$shown4`. Captures show 5 → 4 → 1 → 5 rows for empty → o → so → cleared; uppercase OTHER matches the renamed Other options. AniML alone does not perform the substring filtering.
4. Met with that host helper: numeric `$count` derives from the shown flags; `$countText` formats it. Every checkpoint asserts both the number and semantic count line: 5, 4, 1, 5, 5, 1 results.
5. Met in the CLI semantic tree: Search is a text-field whose value equals `$query`; visible rows expose full data labels; filtered rows are absent. A separate host-write probe also verifies the field value follows a direct `$query` assignment. No browser/OS screen-reader verification is claimed.
6. Met for the host-assisted implementation: `node docs/benchmarks/runs/2026-11-08-p6/search-animl/prove.mjs` captures and asserts data plus semantic trees at all six checkpoints. `evidence/proof-*.txt` holds raw command outputs; `evidence/captures.json` collects the trees and data. Pixel evidence is supplementary only.

Items not met or approximated, and why:

- Item 3 is not self-contained AniML. Filtering requires the supplied host helper. Its shared matching function is exercised by the CLI harness; the optional browser `attachSearch` subscription adapter is supplied but unverified. No completed interactive browser page is claimed.
- The host harness replays complete deterministic histories with `sample` between reads and writes. It does not use a working persistent session: `session --font` failed with a missing text measurer.
- Host filtering requires a subsequent step after the query commits. Counts and semantics are captured after this synchronization.
- The title uses a glyph range spanning the phrase. Test-font glyphs are geometric shapes as required. The lighter Search placeholder is a separate, nonsemantic text overlay visible only for an empty query.

What was hardest; what the docs or diagnostics got wrong or left out:

The documented bind/converter vocabulary has string equality but no substring search or case folding; the tool's own search recipe explicitly uses exact-label equality, which does not meet this brief. A host helper was needed to implement general filtering rather than hard-code the requested queries. Persistent session text measurement failed despite the font argument that works with sample. The fallback harness and its extra runs are included in the counts. The `bad-name` diagnostic was precise and fixed immediately. SVG export omits scene node IDs, so text evidence is inspected by actual rendered content. Sources, helpers and evidence remain entirely inside this folder; nothing was pushed and no PR was opened.

# host-api-resize-backing-surface

Host capability: renderer="canvas" on the HTML element; .ani/AniML syntax and CLI/schema are unchanged.
Implementation: modules/canvas/web/. Spec: SPEC canvas chapter and MODULES §3.1.
Browser evidence: test/web/canvas.test.ts (both engines, existing visual corpus, sizing/diagnostics).
Paired example and core conformance verify host sizing never changes player output.
CLI validate/sample and schema operate on the same document; registry.ts deliberately has no entries.
Rive oracle: no faithful counterpart in a static image for host sizing/backend selection; see the
corresponding tests/oracle skip note. No Rive tool was run.

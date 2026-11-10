# Issues #48–#56 Rottweiler ledger

Branch `issues-48-56` against `origin/main`. One reviewer per round on Codex Web (GPT-5.6 Sol Web,
medium). The orchestrator reproduces each finding, fixes it with the smallest change plus a
regression test, or pushes back with the reason.

| id | severity | finding | outcome |
| --- | --- | --- | --- |
| R1-1 | major | #49's aliasing replaced a component's **own** named instances (component with its own `data` object declaring `other`) with the document's live instance: `$other:value` read 8 instead of 99. | fixed: a child's named instances alias the parent's only when the child is built from the document's data (its raw `data.instances` is the parent's object: no `data` or a model name); own `data` objects keep local instances. Regression: `modules/lists/test/core/main-paths.test.ts` (R1-1). The fix pushed `lists` 24 B over its 5,120 B budget; recovered by sharing the event-forwarding code between #48's fast path and the normal path and compacting the nesting budget wrapper (5,090 B) |

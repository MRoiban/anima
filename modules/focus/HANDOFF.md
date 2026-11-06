# P4c focus integration

Machine conditions: `player.focused` is `string | null`, per player, synchronous with logical focus changes. `focusItems`, `focusTarget`, `focusTraverse`, `focusClear`, `focusPointer`, `focusKey` are installed on the shared Player prototype. `focusKey(key, down = true, shift = false)` handles arrows and opt-in inner Tab traversal. Call it from the input module's key method; the web focus adapter handles arrows independently. Do not dispatch arrows twice.

`spec/SPEC.md` §11.2 defines `key down|up <key> [shift]` and `focus target <id>`, `focus traverse <direction>`, `focus clear`. The small shared script addition is the task's explicit sample-command exception. Merge the input agent's `key` implementation into that case and retain the focus commands. No runtime code outside modules/focus was added.

Focus extends the listener shape after components (which broadens listener on to scoped events). Preserve both changes when merging input's listener additions. The `focus`/`blur` listeners use existing queued actions.

All runtime implementation stays in modules/focus; shared script commands are the explicit sample-command exception. Shared markup tests update only the exact corpus census (98) and static node-field expectation. Generated wiring/schema and docs/parity mappings are included; parity statuses are unchanged.

The components module currently validates an exhaustive event-kind list. Focus init wraps its composed resolve hook and removes only unknown-event diagnostics for local focus/blur listeners in focus-declaring documents. Prefer incorporating focus/blur into the components resolver's recognized input-kind seam when consolidating modules; preserve tests for component-local listeners. Nested players already expose a players map, reused without changing components source.

Final module size: 3924/4096 B incremental, core+web delta 0. Rive CLI absent (exit 127); 16 explicit skip.json files, zero new reference captures.

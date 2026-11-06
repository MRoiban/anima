# P4e-3 implementation evidence

Parity inventory status fields are unchanged. “Implemented” below describes the decided
P4e-3 API; final integration still needs the shared spec/docs chapter and diagnostic table.

| Inventory row | Evidence / remaining scope |
| --- | --- |
| data.host-discover-models | Implemented: models() names, property names/types and resolved enum values. |
| host-api.bind-view-model | Implemented for the document's default model; named storage preserved, independent players and live scene binding tested. |
| host-api.data-boolean | Implemented: boolean handle, value, set, subscription, typed errors. |
| host-api.data-number | Implemented: number handle, clamping, writes/subscriptions; exact native comparisons. |
| host-api.data-string | Implemented: string handle, value/set/subscription; exact native comparisons. |
| host-api.data-reflection | Implemented: models()/instances() detached metadata and enum values. |
| host-api.data-subscriptions | Implemented: order, coalescing, unsubscribe, complete resolved step and next-step callback writes. Native JS callback comparison skipped with evidence. |
| host-api.data-trigger | Implemented: fire, native state-machine forwarding including bound created instances, subscriptions. Native host-fired change-listener final value matches; scene-listener timing differs by one step. |
| host-api.view-model-discovery | Implemented via models() and instances(); look up names/indexes in returned arrays. |
| host-api.view-model-instances | Implemented: create(model, values), authored/named/default records, bind. |
| host-api.data-color | Decided API implemented with hex/RGBA arrays; broader RGB/ARGB/channel helper methods remain outside §7. |
| host-api.data-enum | Decided API implemented with member keys and reflected values; broader index mutation/helper methods outside §7. |
| host-api.data-list | Decided API implemented with whole-list set/get and nested handles, heterogeneous items and shared references. Append/insert/remove/swap helpers outside §7. |
| host-api.data-font | Decided API implemented for declared font asset IDs; decoded-font replacement consumer is not in data/§7. CLI rejects font writes (oracle/unsupported). |
| host-api.data-image | Decided API implemented for declared image asset IDs; decoded-image replacement consumer is outside §7. CLI rejects image writes (oracle/unsupported). |
| host-api.nested-models | Decided $nested.property and $list.0.property paths implemented; slash paths and null-on-mismatch conflict with the decided $ syntax/typed errors. |
| host-api.global-models | Root models/instances available; separate global-name and child-context APIs were not specified in §7 and remain pending. |
| host-api.data-artboard | Pending P5 component-value/placement interface; §7 explicitly lists no artboard handle. |

Host has no new JSON or AniML fields: registry entries/both spellings are not applicable.
The example uses data's existing descriptors in both source and generated JSON. CLI validation,
inspection and sample work; the CLI docs test intentionally fails until spec/SPEC.md has its
host heading (see INTEGRATION.md). No pre-existing pending probe marker was removed. Fresh shared scaffold probes were
discarded with scaffold edits outside ownership; module-owned evidence is used instead.
No protected oracle manifest or measurement input was changed.

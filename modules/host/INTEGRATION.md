# Shared-file integration handoff

This task owns modules/host plus generated wiring. These edits belong to the integrator:

1. Add this chapter to spec/SPEC.md. The CLI discovers module documentation from its
   one-word section heading; this fixes the intentionally retained failing CLI integration test.

   ```markdown
   ## host

   Optional host data scripting is specified in
   [modules/host/SPEC.md](../modules/host/SPEC.md). Import the host entry alongside data;
   no document fields or AniML spellings are added. Host adds typed handles, reflection,
   instances, binding, batched writes, subscriptions and the web auto-bind attribute.
   ```

2. Include the page-author section from modules/host/AUTHORING.md in docs/AUTHORING.md.
3. Optionally move/copy examples/page.html under examples/web and adjust its relative
   bundle/source paths. The runnable source remains module-owned for now.
4. Export the data diagnostic-code table from data/core/index.ts and the composed data
   module; replace host/core/errors.ts's local `codes` table with that export. Data currently
   contains inline diagnostic strings and exports no table, so a single shared table cannot
   be achieved from host-owned files alone.

The module validates runtime instance creation and list replacement with the existing data
loader, then transfers the validated graph into dataState(player). It preserves named-reference
identity and never mutates shared compiled metadata. Per-player default alias routing wraps the
public DataState.ref/read methods. A first-class data runtime factory/rebind API could replace
this adapter later; it is not required for the implemented API's tested behavior.

No parity status fields were changed. ROWS.md distinguishes the decided P4e-3 API from broader
inventory row descriptions. Measurement tools and oracle manifests were not changed.

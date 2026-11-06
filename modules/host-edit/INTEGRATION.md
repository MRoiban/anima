# P5b-2 integration handoff

Only module-owned files, generated wiring and WORKLOG.md are changed. No parity statuses,
measurement tools/inputs, protected modules, shared docs, branch pushes or PRs are changed.

## Shared documentation

Include AUTHORING.md after docs/AUTHORING.md's Page data API section. Add this normative pointer
under a new `## host-edit` chapter in spec/SPEC.md:

> Optional page-data editing is specified in [modules/host-edit/SPEC.md](../modules/host-edit/SPEC.md).
> Import host-edit alongside host and data. It adds identity-preserving list mutation, default/named
> instance discovery, color/enum helpers, web image replacement, nested component player access,
> component root selection and a constructor readiness promise. It adds no document fields.

The shared spec/guide edits are left to the parent to avoid overwriting parallel P5b sections.
The CLI docs topic filter in packages/cli/src/cli.ts also accepts only /^[a-z]+$/ headings; it needs
hyphen support before `anima docs host-edit` can discover this chapter. CLI validate/inspect/sample
of both example spellings already work and are tested; no CLI documentation-topic claim is made.

## Missing seams, precisely

1. Core modules.ts registerModule accepts `/^[a-z]+(?:@[1-9]\d*)?$/`, and new-capability.ts permits
   only lowercase letters for --module. Those validators reject the decided `host-edit` name; the CLI docs filter rejects its topic too. The folder,
   manifests, generated exports and browser entry use host-edit; its runtime key is temporarily
   `hostedit`. All 27 required dry-run/run attempts are recorded in verification/scaffold.txt.
   Accepting hyphenated runtime names and scaffold module names would remove this discrepancy.
2. HostData has private #pending, #records, #bound and #owned. DataState.instances is public, but
   reassigning an entry leaves host records/subscriptions reading the old object. Global replacement
   therefore requires a host-owned `rebindInstance(name, instance)` that updates those records,
   scalar ref routing and child shared-global contexts atomically. We do NOT change compiled
   metadata or access private fields to simulate this. `.instance(name)` already retrieves named
   global records, but `.setGlobal` and global-name reflection remain pending.
3. HostData exposes no enqueue hook. The adapter has a separate queue before host's queued writes;
   helpers compose in order and subscriptions run once after the final step. For cross-API call
   order, expose `enqueue(write)` and a busy/batch-aware wake hook on the active host module/API.
   The helper's current before-host order is documented and tested, not claimed as call-order parity.
4. Data PropertyType/registry/loader do not yet accept `component`, and components cannot consume
   `$component` property values. P5b wave 2 needs the decided component-name property representation,
   typed validation, host handle and dynamic component-node consumer before artboard-valued rows can
   complete. `icon.instance(id)` is an existing nested player, not a swappable artboard value.
5. AnimaIcon's src callback owns fetch; load() always invokes core load() and only accepts source
   text/objects, not an existing Model. Assets are resolved per model in a static hook, with a
   per-icon resolver that can vary. A clean URL cache needs a source-loader hook plus a supported
   compiled-Model instantiation path and cache identity including resolver/policy. No global fetch,
   JSON.parse or browser prototype is patched; parsed-file/decoded-asset reuse remains pending.

## Lists handoff

Helpers mutate `activeDataModule.dataState(player).instances` in place with Array.splice. The live
array and all surviving item objects keep identity, including named aliases and multiple queued
mutations. Fresh defaults are created through host.create (thus discoverable as host-created
instances); mixed lists take an explicit named/create record. Host has no anonymous item factory
or record-disposal hook; removed created records remain discoverable. Lists/repeat should match
these stored objects, never host's detached `.value` snapshots. At() retains an item identity;
re-resolve its typed property accessor after a move because host scalar handles are path-based.

Host records passed to insert/remove select the local instance with the same name/model. Use
instance(name) to reacquire a record when extending an already-running host. Whole-list set retains
host's original replacement behavior. Component/default-context hosts operate through the active
runtime's DataState; no separately bundled WeakMap is consulted.

Model metadata seam for mixed repeats: host-edit initializes DataState.modelTypes before a new
HostData is constructed, so initial/created/whole-list-replacement values share model metadata.
The extension indexes existing default graphs and tags each helper-inserted named/create item too.
For an API created BEFORE host-edit loads, host's private fallback map cannot be retroactively
shared: helper insertions publish their model, but newly allocated items in a later ordinary
whole-list set need data to initialize modelTypes at scope creation (or a host-owned map export).
The late-host whole-list-replacement mixed-repeat combination remains unverified; raw helper
identity and new-host metadata publication are directly tested here.

Cached-model image isolation: assets.resolvedAssets is keyed by Model. If the parent adds shared
compiled-Model loading, image overrides need a per-player/per-icon layer over shared decoded base
resources; otherwise replacing one icon's image would affect every player of that model. Current
isolation is tested with independently loaded models; shared-model override isolation is unverified.

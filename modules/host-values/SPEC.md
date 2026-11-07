# Host value construction

Host loads this companion automatically in the browser. Core host can use the registered hostvalues companion or its own factory fallback, so callers
may keep registering just data and host. Its HostValues constructs and validates detached host values through the active data loader,
preserves named aliases, indexes model identity and copies snapshots. It adds no document fields
or page-facing API; existing host creation, handle validation and diagnostics remain unchanged.
The manifest uses host-values; the runtime key is hostvalues under the current core name validator.
The 2048 B budget covers value construction; host is measured over this automatically loaded dependency.
This split follows the graph/storage boundary in docs/research/rive-format-and-graph.md §6.

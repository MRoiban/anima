# data.bind-keyframes — pending

P5b-5: track values and TrackM.sample(time) are shared by Model and have no player context. Motion needs a generic player-aware value/sampling hook in core load/player/modules, beyond this task's core guard ownership; mutating shared tracks would break independent players. DESIGN §6 syntax is decided; implementation is pending.

Required integration: pass the owning player to track-value sampling, validate typed `$path` key values without replacing the authored document, and resolve each key once per player sample before interpolation/crossfades. Core and independent TimelineInstance sampling must both use it. Do not put current values on shared TrackM objects.

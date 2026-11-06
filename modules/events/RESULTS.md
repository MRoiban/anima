# P4d implementation report

STATUS: 32/33 requested rows implemented; events.script-event-context deferred to P9 (no script VM).
Parity status values remain unchanged for the integration owner; construct/evidence mappings are updated.
Branch: t3/p4d-animation-events. Local commit only; no push, PR, merge or publication.

## Verification

- npm run test:scope -- events conformance oracle: 758 passed, 10 files, no skips/TODOs.
- Module-owned tests: 23 core + 3 CLI + 24 browser (12 Chromium, 12 Firefox).
- Conformance: 7 new independent, hand-calculated cases; 88 total passed.
- Rive oracle: 0 new captures; 33 explicit skip notes, validated by the skip-note checks. Existing 31 captured oracle cases passed. Local CLI help and workflow command documentation expose no reported-event observation stream; DOM/Web Audio/navigation are host behavior and pixels cannot establish payload or event timing equivalence. No Rive scene/scaffold, source, docs text or binary was copied/read/converted.
- Prettier, ESLint, TypeScript, generated module wiring, JSON Schema, AniML corpus and browser artifacts checked.
- Additional components/motion scope: 692 passed, 48 out-of-scope conformance names skipped.
- Broader core/motion/web unit scope: 1001 passed / 3 failed initially, all three were the independent AniML reader's missing new forms; the final events scope includes that complete reader and passes. No suite/time/byte/pixel limit was relaxed.

## Metrics

All sizes use unchanged tools/size.ts, minified + gzip:

| Entry | Bytes | Ceiling |
| --- | ---: | ---: |
| core + web | 19278 (+266 vs 19012 baseline) | 30720 |
| events including audio and markup hook | 3418 | 4096 |
| motion | 6006 | 8192 |
| full-featured SVG total | 54867 | 102400 |
| Rive-class total | 59100 | 256000 |

Existing modules also pass their budgets. No runtime dependencies added.

Latest unchanged tools/perf.ts output (concurrent work on this machine; no regression claim):

```text
compile: bell 2.34 ms; all 9040 prefixes 872 ms
frame: bell 49.6 µs; composite 30.5 µs
frame: toolbar 34.3 µs (step + draw, 4 instances)
compile: toolbar 4.14 ms
```

An earlier run during this task measured bell 4.07 ms / prefix 963 ms, bell frame 50.3 µs,
composite 29.1 µs, toolbar 30.1 µs and toolbar compile 4.15 ms. Timing is load-sensitive.

## Deviations and limits

Core/web/markup contain small optional hook seams; components consumes module-declared event
names and validates only its scoped listener namespace; motion's crossing API accepts an optional marker
list so events reuses work-area/reverse/hold semantics without changing authored timeline arrays.
Named state endEmit and transition startEmit/endEmit actions share the payload and host-delivery path.
The independent AniML reader learned the new forms and its exact corpus census increased 81→88.
These are shared integration changes beyond module-owned source and generated wiring.

Phase integration/agent-native benchmark/parity status promotion remain with the parent task.
Audio is tested with mocked AudioContext, including gain composition, decode caching/failure,
pre-gesture dropping, stale decode invalidation, component ownership and cleanup. No real speaker
output or cross-browser autoplay guarantee is claimed. Browser policy remains authoritative.
Opening URLs requires explicit host opt-in; HTTP(S) and relative same-origin checks remain mandatory.

## Implemented rows (32/33)

- animation.key-event-target
- animation.loop-callback
- assets.audio-volume
- events.audio
- events.host-delivery
- events.host-url-policy
- events.payload-boolean
- events.payload-key-bind
- events.payload-number
- events.payload-string
- events.state-end
- events.transition-end
- events.transition-start
- events.url
- events.url-target-blank
- events.url-target-parent
- events.url-target-self
- events.url-target-top
- host-api.automatic-url-events
- host-api.event-advance
- host-api.event-draw
- host-api.event-load
- host-api.event-loaderror
- host-api.event-loop
- host-api.event-pause
- host-api.event-play
- host-api.event-riveevent
- host-api.event-statechange
- host-api.event-stop
- host-api.event-subscriptions
- host-api.volume
- input.event-listener

Deferred: events.script-event-context — P9 owns scripting and there is no VM/context yet.

## Oracle correction after independent CLI runs

The earlier “no reported-event observation stream” claim above is incorrect. The installed
`~/.rive/bin/rive` reports events and URLs in headless session logs. The independent
[oracle re-audit](ORACLE-RESULTS.md) re-decided all 33 original skips: nine verified comparisons,
23 specific host/output/target/context skips and one listener-order finding. Two additional
boundary-timing findings limit otherwise verified timeline/state/transition probes. See the
re-audit for exact numbers and the payload data-dump mapping; the original no-capture count
must not be used as the current verification state.

P4d-2 follow-up: the fixed 1e-9-second boundary rule resolves the transition boundary probe
(30/30/45 in both). Keys now report 15/30/60 versus native 15/30/61; listener 14/29 versus
native 13/28 is an intentional difference. The current report is ORACLE-RESULTS.md; final
full check passes 2530 tests, with nine further conformance cases and strict oracle exit 0.

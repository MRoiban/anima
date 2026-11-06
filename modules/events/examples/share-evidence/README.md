# P4d-3 share acceptance evidence

The source is `../share.animl` (40 lines, 1,960 characters), compiled to `../share.ani`.
The counter is one expression write; three states distinguish rest, pulse and milestone pulse.
No host code increments the input. The own 80 ms mono 16-bit 16 kHz WAV is a decaying 660 Hz sine:
`round(8000*sin(2*pi*660*i/16000)*(1-i/1280))`, for samples 0 through 1279.

From the repository root:

```sh
node packages/cli/src/main.ts validate modules/events/examples/share.animl
node tools/build-animl.ts --check
node packages/cli/src/main.ts sample modules/events/examples/share.animl --script modules/events/examples/share-evidence/clicks.script
node packages/cli/src/main.ts sample modules/events/examples/share.animl --script modules/events/examples/share-evidence/pulse.script
node packages/cli/src/main.ts sample modules/events/examples/share.animl --script modules/events/examples/share-evidence/interrupt.script
python3 modules/events/examples/share-evidence/verify.py
npm run test:scope -- bind events core markup conformance components
node packages/cli/src/main.ts render modules/events/examples/share.animl --compare docs/benchmarks/runs/2026-11-09-p4d/animl/expected-rest.svg -o /tmp/p4d-share-rest.png
```

The three `.jsonl` files retain raw public CLI snapshots; the independent Python verifier checks:

1. Count 0 at rest, then 1–25. Pulse curves sampled every 0.05 seconds match each 0.3-second
   triangle, peaking at 1.3 at 0.15/0.20/0.25 seconds with pivots at the circles' centres.
2. All 25 pulse entries emit `shared` at local time 0 with `{count:n,channel:"button"}`.
   At click 15, global time 5.6 s, payload count is 15; click 25 is global time 9.6 s, count 25.
3. All 25 completions emit `pulse-done` at local time 0.4 (global 0.4 through 10 s).
   The interruption script restarts at 0.1 s and reports only the final completion at global 0.5 s.
4. Milestones occur only at counts 5/10/15/20/25 (global 1.6/3.6/5.6/7.6/9.6 s), each carrying
   `https://example.org/thanks`, `_blank`. The browser asserts no navigation without permission.
5. Every shared event requests `tone`. The events browser test loads this exact document and WAV
   bytes, drives fifteen clicks through the public frame API, verifies payloads and milestones,
   and checks one cached decode and fifteen source-start requests through the real events audio
   path using a mocked AudioContext. This is request-path verification, allowed by the brief;
   it does not claim audible playback. Existing events audio tests retain activation, volume,
   failure, resolver and lifetime checks. Both Chromium and Firefox pass.
6. The rest document contains only the specified two strokes and three ink circles. CLI pixel
   comparison with the benchmark's unchanged independent rest reference: **0 differing pixels,
   max channel difference 0, tolerance 0**. No benchmark-run file was modified.

The CLI test also compares `.ani` and `.animl` outputs byte-for-byte with `clicks.jsonl`.
`anima schema listener`, `state`, `transition`, and `--json-schema` expose the added forms.
Seven hand-derived conformance cases cover increment past ten, clamp, same-snapshot writes,
machine action order, modulo, typed payload expressions, and next-step machine-action listeners.

Independent comparative oracle capture is explicitly pending, not passing, in the scaffolder's
`tests/oracle/data-bind-listener-actions/todo.json`. The parity row remains planned. No Rive
source, docs text or binary was used. See `modules/events/P4D-3-RESULTS.md` for costs and checks.

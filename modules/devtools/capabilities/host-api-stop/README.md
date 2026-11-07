# host-api-stop

Implemented in `packages/web/src/index.ts`, independently of the devtools import.
`stop()` holds the current frame and stops its clock; `play()` resumes without carrying paused
wall time. See `docs/AUTHORING.md` and the Chromium/Firefox stop browser test.

The AniML/ANI pair is a valid base scene for the host API; `../../example.html` shows host usage.
This host-only method has no document fields, registry spellings, diagnostics or CLI commands.
Oracle skipped: the browser scheduler/clock has no faithful native local CLI counterpart.

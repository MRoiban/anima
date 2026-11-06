# Oracle mapping

The CLI supplies synthetic controller input and cannot reproduce navigator.getGamepads polling, visibility/focus gating or browser-host teardown. Browser tests stub the browser gamepad API and verify opt-in focus gating.

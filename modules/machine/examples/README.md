# Blend and pulse

The level layer blends dim/bright timeline poses continuously, even after their
timelines complete. The feedback layer independently scales the dot.

An any-state change edge using @after(0) restarts the once pulse on each increase.
Target time starts at zero even after idle or during an existing pulse. @end
returns to idle; decreases and unchanged writes do not restart.

Try `anima sample modules/machine/examples/blend-pulse.animl -e "advance 2; set level 0.5; advance 0; snapshot dot.scale; advance 0.1; snapshot dot.scale"`.
Expected scales: 1 then 1.08. The conformance case machine-change-pulse tests this
recipe, mid-pulse restart, decrease, unchanged writes and blend output.

# Drag slider

Build with `anima build modules/input/examples/drag-slider.animl`.
The rail maps normalized x to grid x=2+16*level. The knob compensates its width.
Event x is in rail coordinates; write maps x → level. Preserve alignment retains
the initial grab offset, while the declared input bounds clamp the result.

Try `anima sample modules/input/examples/drag-slider.animl -e "contact down 0 11 10; contact move 0 15 10; snapshot level knob.x"`.
The initial center is x=10, so grabbing at 11 then moving to 15 yields level=.75.

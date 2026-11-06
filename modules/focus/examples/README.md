# Focus traversal

The row is a disabled focus target but an active closed-loop scope. Its two children
opt into Tab traversal in order, with bounds for spatial arrow navigation. Pointer
down also focuses a target. With input installed, keyboard delivery then calls the
same focus navigation policy.

Try `anima sample modules/focus/examples/traversal.animl -e "focus target first; key down ArrowRight; snapshot"`.
In a web host load the focus and input entries; Tab enters the icon and traverses
the two targets, Shift+Tab goes backward, and arrows move spatially.

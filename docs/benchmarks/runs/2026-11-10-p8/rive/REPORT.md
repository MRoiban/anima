Format: Rive RML + Luau ScriptedLayout
Wall time (first command to done): about 10 minutes
Check/validate/build/render runs: 11  (Rive diagnostics: 0 errors, 0 warnings; 2 behavioral mismatches found by capture and fixed: exit routing and sleeve winding)
Source size: 314 lines, 10,799 characters (scene.rml + arm.luau)
Brief items met (1–6), each with how you checked it:
1. APPROXIMATED only for the mathematically impossible inner dead zone. For every required reachable proof point, runtime.log and evidence/summary.txt show hand error 0.0000 and segment lengths 9.0000 / 8.0000. The implementation clamps points with shoulder distance < 1 because lengths 9 and 8 cannot place the hand there.
2. MET. The +alpha IK branch keeps the elbow on the right-hand side in screen coordinates. Required reachable samples have positive cross products: 43.3332 at (22,12), 62.0622 at (14,26), and 47.0508 at (2,20).
3. MET. At pointer (39,2), the runtime reports hand distance 17.0000, upper/fore lengths 9.0000 / 8.0000, and shoulder-pointer/shoulder-hand line cross -0.0001 (rounding from logged 4-decimal coordinates).
4. MET. Rive runtime proof at leave 0.0 / 0.2 / 0.4 s gives hand (22,12) / (23.5,16) / (25,20). Across 25 samples at 60 Hz, hand step min/max are 0.3560 / 0.3561 grid units and midpoint error is 0.0000.
5. MET. The required pointer samples all report pupil offset <= 1.0000; rest is exactly (32,6). The scene caps pupil displacement to one grid unit.
6. MET. evidence/runtime.log is emitted by the running Rive scene; evidence.py parses those numbers and reproduces the invariant checks in evidence/summary.txt. commands.txt captures rest, four pointer poses, and leave frames at 0 / 0.2 / 0.4 s.
Items not met or approximated, and why:
- Behaviour item 1 is impossible literally for shoulder distances below 1 grid unit: a 9-unit and 8-unit two-link chain has minimum endpoint distance |9-8| = 1. The scene clamps only that impossible region; all required benchmark proof positions are handled exactly.
What was hardest; what the docs or diagnostics got wrong or left out:
- Headless `pointer exit@...` arrived through pointerMove with event.type == 'pointerExit' in this scene, while the dedicated pointerExit hook did not fire in the first capture. The implementation handles both paths.
- Rive's clockwise path fill rule made the first sleeve outline invisible when wound the other way. `--verify` and `inspect` stayed clean, so only a rendered capture exposed it. Reversing the one closed outline fixed the sleeve.

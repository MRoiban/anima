Native reference authored independently with the local Rive CLI 1.9.x. The scene uses only rectangle art (D44): a 120 px square clipped viewport and three 120 px rows. The scroll offset is bound to the exported view-model number `offset`; `commands.txt` sets 0, -120 and -240 px, matching Anima offsets 0, 10 and 20 grid units at 12 px/unit without pointer or wheel input. Rive offsets are negative when content moves upward.

Raw Anima/native comparison, threshold 16: frame 0 max 1 with 0/57,600 pixels over 16; frame 0.5 max 1 with 0/57,600 over 16; frame 1 max 1 with 0/57,600 over 16. Classification uses the foreground mask in each image: a pixel is interior only when its complete 3x3 neighborhood is foreground in both renderings. All frames have 0 edge / 0 interior pixels over 16. No oracle budget is assigned here.

`commands.txt` reproduces the three native captures. Generated build output, native frame PNGs and binary files are not retained.

# Fitted background regression

Same original font and explicit-leading mapping as text-background. Both sides uniformly fit
32.4 x 12 pixels into a 16.2 x 6 pixel fixed box (scale 0.5). The initial Anima background
retained unscaled ascent/descent: max 255, 65 pixels over 16. Scaling the metrics fixes geometry;
final max32, two corner pixels over16. See tests/oracle/TEXT-EFFECTS-PROBES.md.

# Oracle mapping

The headless CLI receives artboard coordinates and cannot observe browser SVG getScreenCTM or CSS host alignment transforms. Browser tests check inversion against the actual SVG matrix and canvas viewport.

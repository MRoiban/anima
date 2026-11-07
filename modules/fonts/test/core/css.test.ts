import { expect, it } from 'vitest';
import { cssFont } from '../../core/css.ts';
it('maps FontSpec to reusable SVG/CSS and canvas font properties', () => {
  expect(
    cssFont({
      family: 'Inter, serif',
      size: 12,
      weight: 600,
      style: 'italic',
      tracking: 0.5,
      axes: { wght: 650 },
      features: { liga: 0 },
    }),
  ).toEqual({
    font: 'italic 600 12px Inter, serif',
    fontFamily: 'Inter, serif',
    fontSize: '12px',
    fontWeight: '600',
    fontStyle: 'italic',
    letterSpacing: '0.5px',
    fontVariationSettings: '"wght" 650',
    fontFeatureSettings: '"liga" 0',
  });
  expect(
    cssFont({ family: 'serif', size: 10, weight: 400, style: 'normal', tracking: 0 })
      .fontFeatureSettings,
  ).toBe('normal');
});

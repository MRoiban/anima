import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { measureRaster } from '../../../paint/probes/raster.ts';
import { measureAngular } from '../../../paint/probes/angular.ts';
it('confines all native path raster findings to the stroke fringe and checks recorded evidence', () => {
  const results = measureRaster();
  expect(results).toEqual(JSON.parse(readFileSync('modules/paint/probes/raster.json', 'utf8')));
  for (const m of results) {
    expect(m.nonEdgeOver2, m.name).toBe(0);
    expect(m.sameRenderer.maxDiff, m.name).toBe(m.name === 'detached-vertex' ? 12 : 0);
  }
});
it('identifies the native angular seam as periodic ramp texture filtering, not gradient geometry', () => {
  const result = measureAngular();
  expect(result).toEqual(JSON.parse(readFileSync('modules/paint/probes/angular.json', 'utf8')));
  expect(result.samplerModels.find((m) => m.rampTexels === 512)).toMatchObject({
    maxChannelDelta: 2,
    channelsOver2: 0,
  });
  expect(result.holdoutMax).toBeLessThanOrEqual(2);
  expect(result.holdoutChannelsOver2).toBe(0);
  expect(result.ignoredCenterMax).toBe(0);
  expect(result.interiorOver2).toBe(0);
  expect(result.seamOver2).toBe(156);
});

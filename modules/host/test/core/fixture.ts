import '@anima-format/core/all';
import { expect } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
export function document() {
  return {
    anima: '0.1',
    name: 'host-data',
    grid: 20,
    requires: ['data', 'assets'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
    assets: {
      image: { type: 'image', source: 'data:image/png;base64,iVBORw0KGgo=' },
      font: { type: 'font', source: 'data:font/woff2;base64,AAAA' },
    },
    data: {
      models: {
        Score: {
          properties: {
            score: { type: 'number', default: 2, min: 0, max: 20 },
            label: { type: 'string', default: 'Ada' },
            active: { type: 'bool' },
            tint: { type: 'color', default: '#12345678' },
            pulse: { type: 'trigger' },
            mood: { type: 'enum', values: ['calm', 'happy'] },
            image: { type: 'asset-ref', assetType: 'image' },
            font: { type: 'asset-ref', assetType: 'font' },
            items: { type: 'list', of: 'Item' },
            team: { type: 'model-ref', model: 'Item' },
          },
        },
        Item: { properties: { count: { type: 'number', default: 3 } } },
      },
      instances: {
        main: { model: 'Score', default: true, values: { score: 4, items: [{ count: 5 }] } },
        other: { model: 'Score', values: { score: 7 } },
      },
    },
    bind: { 'dot.r': { value: '$score' } },
  };
}
export function player(doc: object = document()) {
  const result = load(doc);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
}

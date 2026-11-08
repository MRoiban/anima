export function liveDocument() {
  return {
    anima: '0.1',
    name: 'live-runs',
    grid: 20,
    requires: ['text', 'data', 'host'],
    textStyles: {
      normal: { font: 'Anima Test', size: 1, fill: { color: '#123456' } },
      alternate: { font: 'Anima Test', size: 2, fill: { color: '#cc2200' } },
    },
    data: {
      models: {
        Main: {
          properties: {
            style: { type: 'text-style', default: 'normal' },
            items: { type: 'list', of: 'Item', default: [{ label: 'AB', ink: 'normal' }] },
          },
        },
        Item: { properties: { label: { type: 'string' }, ink: { type: 'text-style' } } },
      },
      instances: { main: { model: 'Main', default: true } },
    },
    nodes: [
      {
        id: 'list',
        type: 'text',
        x: 2,
        y: 2,
        runs: '$items' as string | { text: string; style: string }[],
        textField: 'label',
        styleField: 'ink',
      },
      { id: 'typed', type: 'text', x: 2, y: 6, runs: [{ text: 'CD', style: '$style' }] },
    ],
  };
}

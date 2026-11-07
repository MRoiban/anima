import { expect, it } from 'vitest';
import { load } from '../src/index.ts';
it.each(['machine', 'motion'])('B13 an unregistered %s feature names the web import', (feature) => {
  const result = load({
    anima: '0.1',
    name: 'missing-module',
    grid: 20,
    requires: [feature],
    nodes: [],
  });
  expect(result.model).toBeUndefined();
  expect(result.diagnostics).toContainEqual({
    code: 'unknown-feature',
    severity: 'error',
    pointer: '/requires/0',
    message: expect.stringContaining(feature),
    hint: `import '@anima-format/web/${feature}' before loading this document`,
  });
});

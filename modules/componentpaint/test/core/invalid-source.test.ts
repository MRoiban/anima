import '../../../../packages/core/src/all.ts';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load } from '../../../../packages/core/src/index.ts';
import { compile } from '../../../../packages/markup/src/index.ts';
// Component wrappers are forbidden by components. A source must preserve that diagnostic,
// rather than attempting to iterate an invalid wrapper while constructing its child document.
it.each([1, null, {}])(
  'diagnoses an invalid definition requires wrapper without throwing: %j',
  (requires) => {
    const built = compile(readFileSync('modules/componentpaint/examples/live.animl', 'utf8'));
    expect(built.diagnostics).toEqual([]);
    const doc = JSON.parse(JSON.stringify(built.doc));
    doc.components.row.requires = requires;
    const result = load(doc);
    expect(result.model).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unknown-key',
        pointer: '/components/row/requires',
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  },
);

it.each(['stops', 'gradientTransform'])(
  'keeps paint validation for unrelated gradient fields: %s',
  (field) => {
    const doc = JSON.parse(
      JSON.stringify(
        compile(readFileSync('modules/componentpaint/examples/live.animl', 'utf8')).doc,
      ),
    );
    doc.nodes[0].fill[field] =
      field === 'stops'
        ? [
            { position: 0, color: '#000' },
            { position: 1, color: '#fff' },
          ]
        : [1, 0, 0, 1, 0, 0];
    expect(load(doc).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'bad-value',
        pointer: '/nodes/0/fill/' + field,
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  },
);

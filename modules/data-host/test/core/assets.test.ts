import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { drawFrame } from '../../../../packages/core/src/draw.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
function literal(source: string) {
  return {
    anima: '0.1',
    name: 'asset-call',
    grid: 20,
    requires: ['datahost', 'data', 'bind', 'assets'],
    assets: { photo: { type: 'blob', source: 'data:application/octet-stream,hello' } },
    data: {
      models: {
        Root: { properties: { image: { type: 'asset-ref', assetType: 'blob', default: 'photo' } } },
      },
    },
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 2, fill: { color: '#000' } }],
    bind: { 'dot.r': { value: source } },
  };
}
it('validates asset names in expressions in both syntaxes without interpreting quoted text', () => {
  for (const raw of [
    literal('$image == asset("photo")'),
    compile(decompile(literal('$image == asset("photo")'))).doc!,
  ]) {
    const r = load(raw);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const p = new Player(r.model!);
    p.step(0);
    expect(p.value('dot.r')).toBe(1);
  }
  const r = load(literal('"asset(\\"missing\\")" == "asset(\\"missing\\")"'));
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const invalid = load(literal('$image == asset("missing")'));
  expect(invalid.model).toBeUndefined();
  expect(invalid.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'unknown-asset',
      pointer: '/bind/dot.r',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
it('binds separate image resource slots and safely falls back for unavailable runtime resources', () => {
  const doc = JSON.parse(
    readFileSync(
      new URL('../../../../spec/conformance/data-host-image-binding/case.ani', import.meta.url),
      'utf8',
    ),
  );
  const r = load(doc);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  p.set('$one', 'other');
  p.step(0);
  expect(p.value('one.asset')).toBe('other');
  expect(p.value('two.asset')).toBe('photo');
  p.set('$one', 'missing');
  p.step(0);
  expect(drawFrame(p).nodes[0]!.geometry!.image!.source).toBe(doc.assets.photo.source);
});

import { describe, expect, it } from 'vitest';
import { scene } from '../fixtures/bf1/scene.ts';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { DataError } from '../../../host/core/index.ts';

function player(lists = false) {
  const doc = scene();
  if (lists) (doc.requires as string[]).push('lists');
  const result = load(doc);
  expect(result.diagnostics).toEqual([]);
  const p = new Player(result.model!);
  p.step(0);
  return p;
}
function fills(p: Player) {
  return ['top.fill.color', 'control/face.fill.color', 'control/digit/segment.fill.color'].map(
    (k) => p.values()[k],
  );
}
describe('[BF-1] nested library theme', () => {
  it.each([false, true])('propagates host writes at every depth (batch=%s)', (batch) => {
    const p = player();
    expect(fills(p)).toEqual(['#123456', '#123456', '#123456']);
    const path = 'theme';
    const write = () => p.data.color(`$${path}:ink`).set([255, 0, 0, 255]);
    if (batch) p.data.batch(write);
    else write();
    p.step(0);
    expect(fills(p)).toEqual(['#ff0000', '#ff0000', '#ff0000']);
    const other = player();
    expect(fills(other)).toEqual(['#123456', '#123456', '#123456']);
  });
  it('keeps an explicitly declared child model local, including its descendants', () => {
    const doc = scene();
    const data = doc.data as { instances: { theme: { model: string } } };
    const components = doc.components as { control: { data?: string } };
    components.control.data = data.instances.theme.model;
    const result = load(doc);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const p = new Player(result.model!);
    p.step(0);
    p.data.color('$theme:ink').set('#ff0000');
    p.step(0);
    expect(fills(p)).toEqual(['#ff0000', '#123456', '#123456']);
  });
  it('shares named theme instances when lists owns descendant contexts', () => {
    const p = player(true);
    p.data.color('$theme:ink').set('#abc');
    p.step(0);
    expect(fills(p)).toEqual(['#aabbcc', '#aabbcc', '#aabbcc']);
  });
  it('propagates in-document writes at every depth', () => {
    const p = player();
    p.pointer('down', 1, 1);
    p.pointer('up', 1, 1);
    p.step(0);
    expect(fills(p)).toEqual(['#00ff00', '#00ff00', '#00ff00']);
  });
  it('keeps ancestors awake after an in-document write in the deepest child', () => {
    const p = player();
    p.pointer('down', 5, 5);
    p.pointer('up', 5, 5);
    expect(p.step(0).settled).toBe(false);
    expect(fills(p)).toEqual(['#123456', '#123456', '#abcdef']);
    expect(p.step(0).settled).toBe(true);
    expect(fills(p)).toEqual(['#abcdef', '#abcdef', '#abcdef']);
  });
  it.each(['#abc', '#123456', '#12345678'])('accepts hex colour %s on the next frame', (value) => {
    const p = player();
    p.data.bind('theme');
    p.data.color('ink').set(value);
    p.step(0);
    expect(p.data.color('ink').value).toEqual(
      value === '#abc' ? [170, 187, 204, 255] : [18, 52, 86, value.length === 9 ? 120 : 255],
    );
  });
  it.each([
    'red',
    '#12',
    '#gg0000',
    null,
    [1, 2, 3],
    [0, 0, 0, Infinity],
    [1.5, 0, 0, 255],
    [NaN, 0, 0, 255],
    [256, 0, 0, 255],
  ])('diagnoses bad colour %j', (value) => {
    const p = player();
    p.data.bind('theme');
    expect(() => p.data.color('ink').set(value as never)).toThrow(DataError);
    try {
      p.data.color('ink').set(value as never);
    } catch (e) {
      expect(e).toMatchObject({
        code: 'data-type',
        pointer: '/data/$ink',
        message: expect.any(String),
        hint: expect.any(String),
      });
    }
  });
});

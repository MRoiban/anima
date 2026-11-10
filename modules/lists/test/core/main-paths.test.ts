// Issue #49: `$main:` paths inside a repeated item's computed value must stay absolute.
import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { compile } from '@anima-format/markup';
import { listState } from '../../core/index.ts';

const source = readFileSync(
  new URL('../../../../design/issues/proof/49-main-rows.animl', import.meta.url),
  'utf8',
);

it('reads $main: paths from a repeated item computed value and its bindings', () => {
  const built = compile(source);
  expect(built.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(load(built.doc!).model!);
  p.step(0);
  p.step(0);
  const rows = listState(p)!.runs[0]!.items.map((item) => item.player.values());
  expect(rows.map((v) => v['dot.y'])).toEqual([10, 10]);
  expect(rows.map((v) => v['dot.r'])).toEqual([2, 4]);
});

it('reads $main: plain and converted computed properties from repeated item computed values', () => {
  const glide = readFileSync(
    new URL('../../../../design/issues/proof/49-main-glide.animl', import.meta.url),
    'utf8',
  );
  const built = compile(glide);
  expect(built.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(load(built.doc!).model!);
  p.step(0);
  p.step(1);
  const rows = listState(p)!.runs[0]!.items.map((item) => item.player.values());
  expect(rows.map((v) => v['dot.x'])).toEqual([4, 8]);
  expect(rows.map((v) => v['dot.y'])).toEqual([4, 8]);
});

it('reads $main: from computed values of items the host adds at runtime', () => {
  const glide = readFileSync(
    new URL('../../../../design/issues/proof/49-main-glide.animl', import.meta.url),
    'utf8',
  ).replace(/<set path="items"[^>]*\/>/, '');
  const built = compile(glide);
  expect(built.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(load(built.doc!).model!) as Player & {
    data: { list(path: string): { set(value: unknown): void } };
  };
  p.step(0);
  p.data.list('$main:items').set([{ x: 5 }, { x: 9 }]);
  p.step(0);
  p.step(1);
  const rows = listState(p)!.runs[0]!.items.map((item) => item.player.values());
  expect(rows.map((v) => v['dot.x'])).toEqual([4, 8]);
  expect(rows.map((v) => v['dot.y'])).toEqual([4, 8]);
});

it('keeps $main: live in repeated components after the host changes main (#49)', () => {
  const built = compile(source);
  const p = new Player(load(built.doc!).model!) as Player & {
    data: { number(path: string): { value: number; set(value: number): void } };
  };
  p.step(0);
  p.data.number('$main:total').set(20);
  p.step(0);
  p.step(0);
  const rows = listState(p)!.runs[0]!.items.map((item) => item.player.values());
  expect(rows.map((v) => v['dot.y'])).toEqual([20, 20]);
  expect(rows.map((v) => v['dot.r'])).toEqual([1, 2]);
  expect(p.data.number('$main:items.0.share').value).toBe(0.1);
});

it('keeps $main: computed and converted values live in item computed values (#49)', () => {
  const built = compile(
    readFileSync(
      new URL('../../../../design/issues/proof/49-main-computed.animl', import.meta.url),
      'utf8',
    ),
  );
  const p = new Player(load(built.doc!).model!) as Player & {
    data: { number(path: string): { value: number; set(value: number): void } };
  };
  p.step(0);
  p.data.number('$main:view').set(5);
  p.step(0);
  p.step(0);
  expect(p.data.number('$main:items.0.rel').value).toBe(0);
  expect(p.data.number('$main:items.0.relc').value).toBe(-5);
  const rows = listState(p)!.runs[0]!.items.map((item) => item.player.values());
  expect(rows.map((v) => v['dot.x'])).toEqual([0, 4]);
});

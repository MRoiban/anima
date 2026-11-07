import '@anima-format/core/all';
import { load, Player } from '@anima-format/core';
import { textRun } from '../../core/index.ts';
import { expect, it } from 'vitest';
import { measure, registerTextMeasurer } from '../../core/measure.ts';
import { fixedMeasurer } from './measurer.ts';
it('reports the measurer contract diagnostic and accepts a deterministic host implementation', () => {
  const font = { family: 'test', size: 1, weight: 400, style: 'normal' as const, tracking: 0 };
  try {
    measure(font, 'a');
    throw Error('missing diagnostic');
  } catch (error) {
    expect(error).toMatchObject({
      code: 'text-measurer',
      pointer: '/requires',
      hint: expect.any(String),
    });
  }
  const p = new Player(
    load({
      anima: '0.1',
      name: 'unmeasured',
      grid: 20,
      requires: ['text'],
      nodes: [{ id: 'label', type: 'text', runs: [{ id: 'value', text: 'before' }] }],
    }).model!,
  );
  expect(textRun(p, 'label', 'value')).toBe('before');
  expect(textRun(p, 'label', 'value', 'after')).toBe('after');
  expect(textRun(p, 'label', 'value')).toBe('after');
  registerTextMeasurer(fixedMeasurer);
  expect([...measure(font, 'ab').advances]).toEqual([1, 2]);
});

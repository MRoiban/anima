import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { player } from '../../../host/test/core/fixture.ts';
import { DataError } from '../../../host/core/errors.ts';
it('keeps original typed diagnostics for invalid font assignments without a browser decoder', () => {
  const p = player();
  p.data.bind('main');
  const handle = p.data.font('$font');
  for (const value of [true, 42, {}, null]) {
    let error: unknown;
    try {
      handle.set(value as never);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(DataError);
    expect(error).toMatchObject({
      code: 'data-type',
      pointer: '/data/$font',
      message: expect.any(String),
      hint: expect.any(String),
    });
  }
});

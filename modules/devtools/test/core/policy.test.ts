import { afterEach, expect, it, vi } from 'vitest';
class Icon {
  frame() {}
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});
it('selectively suppresses IDs while preserving once/always/off policies', async () => {
  vi.stubGlobal('customElements', { get: () => Icon });
  vi.doMock('../../../../packages/web/src/index.ts', () => ({}));
  await import('../../web/index.ts');
  const api = Icon as unknown as typeof import('../../../../packages/web/src/index.ts').AnimaIcon;
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  api.warn('a', 'once');
  api.warn('a', 'duplicate');
  api.warnings = { off: ['a', 'b'] };
  api.warn('a', 'suppressed');
  api.warn('b', 'suppressed too');
  api.warn('c', 'selected policy');
  api.warn('c', 'selected repeat');
  api.warnings = 'off';
  api.warn('d', 'global suppression');
  api.warnings = 'once';
  api.warn('b', 'previously suppressed');
  api.warn('c', 'already emitted');
  api.warnings = 'always';
  api.warn('a', 'always');
  api.warn('a', 'always');
  expect(warn.mock.calls.flat()).toEqual([
    'once',
    'selected policy',
    'selected repeat',
    'previously suppressed',
    'always',
    'always',
  ]);
});

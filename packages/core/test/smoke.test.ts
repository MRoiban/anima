import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FORMAT_VERSION } from '../src/index.ts';

describe('repo', () => {
  it('bell.ani is JSON at the supported version', () => {
    const doc = JSON.parse(
      readFileSync(new URL('../../../examples/bell.ani', import.meta.url), 'utf8'),
    );
    expect(doc.anima).toBe(FORMAT_VERSION);
    expect(doc.name).toBe('bell');
  });
});

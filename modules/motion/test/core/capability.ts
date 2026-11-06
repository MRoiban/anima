import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
export function capability(id: string): void {
  it(`${id}: both syntax spellings and a coded diagnostic`, () => {
    const slug = id.replaceAll('.', '-');
    const source = readFileSync(
      new URL(`../../capabilities/${slug}/example.animl`, import.meta.url),
      'utf8',
    );
    const c = compile(source);
    expect(c.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(c.doc).toBeDefined();
    expect(compile(decompile(c.doc!)).doc).toEqual(c.doc);
    const invalid = JSON.parse(
      readFileSync(new URL(`./invalid/${slug}/unknown-feature.ani`, import.meta.url), 'utf8'),
    );
    expect(load(invalid).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unknown-feature',
        pointer: '/requires/0',
        severity: 'error',
        message: expect.any(String),
      }),
    );
  });
}

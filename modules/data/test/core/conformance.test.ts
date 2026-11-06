import { registerConverter } from '../../core/index.ts';
import '@anima-format/core/all';
import { readFileSync, readdirSync } from 'node:fs';
import { it, expect } from 'vitest';
import { load, runScript } from '../../../../packages/core/src/index.ts';
for (const file of readdirSync(new URL('../../conformance/', import.meta.url)))
  it('data conformance ' + file, () => {
    const fixture = JSON.parse(
      readFileSync(new URL('../../conformance/' + file, import.meta.url), 'utf8'),
    );
    if (fixture.converter)
      registerConverter(fixture.converter, (value, _options, ctx) => {
        const n = Number(ctx.state.get('n') ?? 0) + 1;
        ctx.state.set('n', n);
        return Number(value) + n;
      });
    const r = load(fixture.doc);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(runScript(r.model!, fixture.script).snapshots).toEqual(fixture.expected);
  });

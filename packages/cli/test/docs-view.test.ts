import { describe, expect, it } from 'vitest';
import { docsFull } from '../src/docs-view.ts';
import { run } from '../src/cli.ts';

async function invoke(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('docs view', () => {
  it.each([
    ['ik', /^## ik/],
    ['rigging.ik', /^## ik/],
    ['skin', /^## skin/],
    ['constraint', /^## rig/],
    ['constraints', /^## rig/],
    ['semantic', /^## a11y/],
    ['a11y', /^## a11y/],
    ['copy-position', /^### Constraint fields and evaluation/],
  ])('resolves %s', async (topic, pattern) => {
    const result = await invoke('docs', topic);
    expect(result.code, result.err).toBe(0);
    expect(result.out).toMatch(pattern);
  });

  it('keeps misses concise with one list pointer', async () => {
    const result = await invoke('docs', 'ikk');
    expect(result.code).toBe(2);
    expect(result.err).toContain('did you mean "ik"');
    expect(result.err.match(/See 'anima docs --list'/g)).toHaveLength(1);
    expect(result.err).not.toContain('Usage:');
  });

  it('supports full long-form output through the view API', () => {
    const out: string[] = [];
    expect(docsFull('spec', false, false, { out: (s) => out.push(s), err: () => {} })).toBe(0);
    expect(out.join('\n')).toContain('```');
  });
});

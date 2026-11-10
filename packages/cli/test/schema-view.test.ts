import { describe, expect, it } from 'vitest';
import { run } from '../src/cli.ts';

async function invoke(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('schema view', () => {
  it('prints a bounded topic index with open commands', async () => {
    const result = await invoke('schema');
    expect(result.code).toBe(0);
    expect(result.out).toContain('rect\trect node fields');
    expect(result.out).toContain('open: anima schema rect');
    expect(result.out).not.toContain('animatable (address:');
  });

  it('shows one-level object shapes and explicit non-attribute markup', async () => {
    const group = await invoke('schema', 'group');
    expect(group.out).toMatch(/layout: \{[^}]+\}/);
    expect(group.out).toContain('(no attribute; use layout-* attributes) ↔ layout:');
    expect(group.out).not.toContain('\n   ↔ layout:');
  });

  it('ends type pages with feature, docs and examples pointers', async () => {
    const rect = await invoke('schema', 'rect');
    expect(rect.out).toMatch(/Requires: .+\nDocs: anima docs rect\nExamples: .+$/);
  });
});

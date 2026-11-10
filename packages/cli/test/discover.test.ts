import { describe, expect, it } from 'vitest';
import { run } from '../src/index.ts';
import { examples, features, index, search } from '../src/discover/api.ts';

describe('discovery index', () => {
  it('builds unique entries from real sources', () => {
    const entries = index();
    const kinds = new Map<string, number>();
    const seen = new Set<string>();
    for (const e of entries) {
      kinds.set(e.kind, (kinds.get(e.kind) || 0) + 1);
      const k = `${e.kind}:${e.name}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
    for (const k of [
      'feature',
      'type',
      'field',
      'element',
      'address',
      'ease',
      'function',
      'event',
      'script',
      'diagnostic',
      'doc',
      'example',
      'capability',
      'command',
    ])
      expect(kinds.get(k) || 0, k).toBeGreaterThan(0);
  }, 30000);
  it('ranks useful concepts', () => {
    expect(
      search('easing curve', { limit: 5 }).some((h) =>
        ['cubic', 'inOut', 'in', 'out'].includes(h.entry.name),
      ),
    ).toBe(true);
    expect(
      search('bones skeleton', { limit: 5 }).some(
        (h) => h.entry.name === 'rig' || h.entry.name === 'bone',
      ),
    ).toBe(true);
  });
  it('describes ik and rig examples', () => {
    const ik = features('ik');
    expect(ik?.entry.name).toBe('ik');
    expect(ik?.entry.docs).toContain('ik');
    expect(ik?.after).toContain('rig');
    for (const name of ['ik', 'ik.bend', 'ik.bones', 'ik.strength', 'ik.target'])
      expect(
        ik?.provides.some((e) => e.name === name),
        name,
      ).toBe(true);
    expect(
      ik?.provides.some((e) => e.kind === 'address' && e.aliases?.includes('ik.strength')),
    ).toBe(true);
    expect(examples('rig').length).toBeGreaterThan(0);
  });
  it('keeps concrete discovery results ahead of noisy fuzzy matches', () => {
    expect(search('hover', { limit: 5 }).map((hit) => hit.entry.name)).toEqual(['enter', 'leave']);
    expect(search('ease in out', { limit: 5 }).some((hit) => hit.entry.name === 'inOut')).toBe(
      true,
    );
    expect(
      search('contains text filter', { limit: 5 }).some((hit) => hit.entry.name === 'contains'),
    ).toBe(true);
  });
  it('uses meaningful source-derived summaries', () => {
    for (const name of ['a11y', 'bind', 'convert', 'ik']) {
      const summary = features(name)?.entry.summary || '';
      expect(summary.length).toBeGreaterThan(20);
      expect(summary).not.toBe(`${name} module`);
    }
    const capabilityExample = index().find(
      (entry) => entry.kind === 'example' && entry.name.includes('/capabilities/'),
    );
    expect(capabilityExample?.summary).not.toMatch(/^example\.(?:animl|ani)$/);
  });
  it('all doc entries resolve through anima docs', async () => {
    for (const e of index().filter((e) => e.kind === 'doc'))
      for (const d of e.docs || []) {
        const out: string[] = [];
        const err: string[] = [];
        const code = await run(['docs', ...d.split(/\s+/)], {
          out: (s) => out.push(s),
          err: (s) => err.push(s),
        });
        expect(code, `${e.name}: ${err.join('\n')}`).toBe(0);
      }
  }, 30000);
});

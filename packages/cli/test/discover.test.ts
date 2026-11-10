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

  it('contains only identifier-like entry names', () => {
    for (const entry of index()) {
      expect(entry.name.length, `${entry.kind}:${JSON.stringify(entry.name)}`).toBeGreaterThan(0);
      expect(entry.name, `${entry.kind}:${JSON.stringify(entry.name)}`).toMatch(/^\S+$/);
      expect(entry.name, `${entry.kind}:${JSON.stringify(entry.name)}`).toMatch(/[A-Za-z0-9]/);
      if (entry.kind === 'capability')
        expect(entry.name, entry.name).toMatch(/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+$/);
    }
  });
  it('returns no noise for stop-only or unrelated queries', () => {
    for (const query of [
      'change',
      'make',
      'add',
      'use',
      'create',
      'show',
      'do',
      'get',
      'want',
      'how',
    ])
      expect(search(query), query).toEqual([]);
    expect(search('totally unrelated wombat quasiflux')).toEqual([]);
  });
  it('prioritizes interaction vocabulary over capability prose', () => {
    expect(search('pointer', { limit: 5 }).every((hit) => hit.entry.kind === 'event')).toBe(true);
    expect(search('wheel', { limit: 1 })[0]?.entry).toMatchObject({
      kind: 'event',
      name: 'scroll',
    });
    expect(search('keys', { limit: 3 }).map((hit) => hit.entry.name)).toEqual([
      'key-down',
      'key-repeat',
      'key-up',
    ]);
    expect(search('cursor', { limit: 1 })[0]?.entry.kind).toBe('field');
    expect(search('fade', { limit: 3 }).map((hit) => hit.entry.name)).toEqual([
      'in',
      'out',
      '<id>.opacity',
    ]);
    expect(search('random', { limit: 1 })[0]?.entry).toMatchObject({
      kind: 'function',
      name: 'random',
    });
  });
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
    const hover = search('hover', { limit: 5 }).map((hit) => hit.entry.name);
    expect(hover.slice(0, 2)).toEqual(['enter', 'leave']);
    expect(hover.some((name) => name.includes('cover'))).toBe(false);
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

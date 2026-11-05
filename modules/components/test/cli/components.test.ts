import { describe, it, expect } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
const toolbar = new URL('../../../../examples/toolbar.animl', import.meta.url).pathname;
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
describe('component tooling', () => {
  it('inspect shows placements, bound instance attributes and scoped states', async () => {
    const r = await cli('inspect', toolbar, '--format=json');
    expect(r.code, r.err).toBe(0);
    const d = JSON.parse(r.out);
    expect(d.nodes).toContainEqual(
      expect.objectContaining({ id: 'badge', type: 'instance', component: 'badge' }),
    );
    expect(d.instances).toContainEqual(
      expect.objectContaining({ layer: 'badge/badge', state: 'unread' }),
    );
    expect((await cli('inspect', toolbar)).out).toContain('badge/badge: unread');
  });
  it('sample includes scoped instance values and states', async () => {
    const file = new URL(
      '../../../../spec/conformance/components-inputs-bound/case.animl',
      import.meta.url,
    ).pathname;
    const script = new URL(
      '../../../../spec/conformance/components-inputs-bound/script.txt',
      import.meta.url,
    ).pathname;
    const r = await cli('sample', file, '--script', script);
    expect(r.code, r.err).toBe(0);
    const snapshots = r.out.split('\n').map((s) => JSON.parse(s));
    expect(snapshots[1].values).toMatchObject({ 'a/count': 5, 'b/dot.r': 8 });
  });
});

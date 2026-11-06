import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
const root = new URL('../../../../', import.meta.url);
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('samples event payloads identically in JSON and AniML through the public CLI', async () => {
  const folder = new URL('spec/conformance/events-payload-number/', root);
  for (const ext of ['ani', 'animl']) {
    const r = await cli(
      'sample',
      new URL('case.' + ext, folder).pathname,
      '--script',
      new URL('script.txt', folder).pathname,
    );
    expect(r.code, r.err).toBe(0);
    expect(r.out.trim()).toBe(readFileSync(new URL('expected.jsonl', folder), 'utf8').trim());
  }
});
it('exposes typed event definitions and resource gains in the JSON Schema', async () => {
  const r = await cli('schema', '--json-schema');
  expect(r.code).toBe(0);
  const schema = JSON.parse(r.out);
  expect(schema.properties.eventDefs.additionalProperties.properties.payload).toBeDefined();
  expect(schema.properties.audioVolumes.additionalProperties.maximum).toBe(1);
});
it('validates and formats both public example spellings, and serves the normative event topic', async () => {
  for (const ext of ['ani', 'animl']) {
    const file = new URL('modules/events/examples/events.' + ext, root).pathname;
    expect((await cli('validate', file)).code).toBe(0);
    expect((await cli('fmt', file, '--check')).code).toBe(0);
  }
  expect((await cli('docs', 'events')).out).toContain('## events');
});

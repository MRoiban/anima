import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { compile } from '../../markup/src/index.ts';
import { run } from '../src/index.ts';
import { PNG } from 'pngjs';
const dir = mkdtempSync(join(tmpdir(), 'anima-assets-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const source = readFileSync(new URL('../../../examples/photo.animl', import.meta.url), 'utf8');
const embedded = compile(source).doc! as {
  assets: Record<string, { source: string; storage: string; width?: number; height?: number }>;
};
const uri = embedded.assets.photo!.source;
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('build --embed changes only asset declarations, render resolves relative disk sources and decodes dimensions', async () => {
  writeFileSync(join(dir, 'photo.png'), Buffer.from(uri.split(',')[1]!, 'base64'));
  const xml = source
    .replace(uri, 'photo.png')
    .replace('storage="embedded"', 'storage="referenced"')
    .replace(' width="8" height="4"', '');
  const file = join(dir, 'photo.animl');
  writeFileSync(file, xml);
  const plain = await cli('build', file);
  expect(plain.code).toBe(0);
  const result = await cli('build', file, '--embed');
  expect(result.code, result.err).toBe(0);
  const a = JSON.parse(plain.out),
    b = JSON.parse(result.out);
  expect(b.assets.photo.source).toBe(uri);
  expect(b.assets.photo.storage).toBe('embedded');
  delete a.assets;
  delete b.assets;
  expect(a).toEqual(b);
  const png = join(dir, 'out.png');
  const r = await cli('render', file, '-o', png, '--size', '240');
  expect(r.code, r.err).toBe(0);
  const img = PNG.sync.read(readFileSync(png));
  const pixel = (120 * img.width + 120) * 4;
  expect([...img.data.slice(pixel, pixel + 3)]).toEqual([255, 40, 0]);
  const svg = join(dir, 'out.svg');
  expect((await cli('render', file, '-o', svg)).code).toBe(0);
  expect(readFileSync(svg, 'utf8')).toContain('width="20" height="10"');
  const html = join(dir, 'page.html');
  writeFileSync(
    html,
    `<anima-icon><script type="application/vnd.anima+xml">${xml}</script></anima-icon>`,
  );
  const h = await cli('build', html, '--embed');
  expect(h.code, h.err).toBe(0);
  expect(h.out).toContain(uri);
  expect(h.out).toContain('application/vnd.anima+json');
});
it('reports missing referenced files for build and render', async () => {
  const file = join(dir, 'missing.animl');
  writeFileSync(
    file,
    source.replace(uri, 'missing.png').replace('storage="embedded"', 'storage="referenced"'),
  );
  for (const cmd of [
    ['build', file, '--embed'],
    ['render', file, '-o', join(dir, 'missing.png')],
  ]) {
    const r = await cli(...cmd, '--format=json');
    expect(r.code).toBe(1);
    expect(JSON.parse(r.out).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'asset-load', pointer: '/assets' }),
    );
  }
});

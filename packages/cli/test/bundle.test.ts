import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright-core';
import { afterAll, expect, it } from 'vitest';
import { run } from '../src/cli.ts';
import type { AnimaIcon } from '../../web/src/index.ts';

const dir = mkdtempSync(resolve(tmpdir(), 'anima-bundle-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

it('bundles base and single entries byte-identically to dist and reports sizes', async () => {
  for (const name of ['', 'paint', 'bind']) {
    const path = resolve(dir, (name || 'base') + '.js');
    const result = await cli(
      'bundle',
      ...(name ? ['--modules', name] : []),
      '-o',
      path,
      '--format=json',
    );
    expect(result.code, result.err).toBe(0);
    const bytes = readFileSync(path);
    expect(bytes).toEqual(
      readFileSync(resolve('packages/web/dist/anima-' + (name || 'icon') + '.js')),
    );
    expect(JSON.parse(result.out)).toMatchObject({
      wrote: path,
      min: bytes.length,
      gzip: gzipSync(bytes).length,
    });
  }
}, 30000);

it.each(['paimt', 'paint,,bind', '../paint'])(
  'diagnoses unknown module %s with a suggestion',
  async (name) => {
    const result = await cli(
      'bundle',
      '--modules',
      name,
      '-o',
      resolve(dir, 'bad.js'),
      '--format=json',
    );
    expect(result.code).toBe(1);
    expect(JSON.parse(result.out).diagnostics[0]).toMatchObject({
      code: 'bundle-module',
      pointer: '/modules/' + (name.includes(',') ? 1 : 0),
      message: expect.any(String),
      hint: expect.stringContaining('paint'),
    });
  },
);

it('rejects positional arguments', async () => {
  expect((await cli('bundle', 'paint')).code).toBe(2);
});

async function render(scripts: string[]) {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ??
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      ),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<anima-icon style="display:block;width:100px;height:100px"></anima-icon>',
    );
    for (const content of scripts) await page.addScriptTag({ type: 'module', content });
    return await page.evaluate(async () => {
      const modules = [...(customElements.get('anima-icon') as typeof AnimaIcon).modules.keys()];
      const icon = document.querySelector('anima-icon')!;
      await icon.load({
        anima: '0.1',
        name: 'bound-gradient',
        grid: 20,
        requires: ['paint', 'bind'],
        inputs: { radius: { type: 'number', default: 7 } },
        nodes: [
          {
            id: 'circle',
            type: 'circle',
            center: [10, 10],
            r: 1,
            fill: {
              type: 'linear',
              x1: 0,
              y1: 0,
              x2: 20,
              y2: 0,
              stops: [
                { position: 0, color: '#ff0000' },
                { position: 1, color: '#0000ff' },
              ],
            },
          },
        ],
        bind: { 'circle.r': 'radius' },
      });
      // seam(P8-1): retain loader diagnostics when independent bundles fail.
      await icon.ready.catch((diagnostics: unknown) => {
        throw Error(JSON.stringify(diagnostics));
      });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      return {
        modules,
        radius: icon.shadowRoot!.querySelector('circle')?.getAttribute('r'),
        gradient: !!icon.shadowRoot!.querySelector('linearGradient'),
        fill: icon.shadowRoot!.querySelector('circle')?.getAttribute('fill'),
      };
    });
  } finally {
    await browser.close();
  }
}

it('checks the reported two-dist collision (already supported on current HEAD)', async () => {
  const result = await render(
    ['paint', 'bind'].map((name) =>
      readFileSync(resolve('packages/web/dist/anima-' + name + '.js'), 'utf8'),
    ),
  );
  expect(result.modules).toEqual(expect.arrayContaining(['paint', 'bind']));
  expect(result).toMatchObject({
    radius: '7',
    gradient: true,
    fill: expect.stringContaining('url('),
  });
}, 30000);

it('loads one chosen-module ESM and renders a scene requiring paint and bind', async () => {
  const path = resolve(dir, 'combined.js');
  const result = await cli('bundle', '--modules', 'paint,bind', '-o', path);
  expect(result.code, result.err).toBe(0);
  expect(result.out).toMatch(/min.*gzip/);
  const rendered = await render([readFileSync(path, 'utf8')]);
  expect(rendered.modules).toEqual(expect.arrayContaining(['paint', 'bind']));
  expect(rendered).toMatchObject({
    radius: '7',
    gradient: true,
    fill: expect.stringContaining('url('),
  });
}, 30000);

it('canonicalizes duplicates and user order using manifest after order', async () => {
  const first = resolve(dir, 'ordered.js'),
    second = resolve(dir, 'reversed.js');
  const a = await cli('bundle', '--modules', 'bind,paint,bind', '-o', first, '--format=json');
  const b = await cli('bundle', '--modules', 'paint,bind', '-o', second, '--format=json');
  expect(a.code, a.err).toBe(0);
  expect(b.code, b.err).toBe(0);
  // Check the registry's ordering against independently discovered manifests.
  const { discover } = await import('../../../tools/modules.ts');
  const order = (await discover(resolve('.'))).flatMap((m) => m.web.map((e) => e.name));
  expect(JSON.parse(a.out).modules).toEqual(order.filter((n) => ['paint', 'bind'].includes(n)));
  expect(readFileSync(first)).toEqual(readFileSync(second));
}, 30000);

it('writes anima.js by default and keeps diagnostic messages with --verbose', async () => {
  const previous = process.cwd();
  try {
    process.chdir(dir);
    const result = await cli('bundle', '--verbose');
    expect(result.code, result.err).toBe(0);
    expect(result.out).toMatch(/^anima.js: \d+ B min; \d+ B gzip$/);
    const verbose = readFileSync(resolve(dir, 'anima.js'), 'utf8');
    expect(verbose).toContain('unknown key');
    expect(
      readFileSync(resolve(previous, 'packages/web/dist/anima-icon.js'), 'utf8'),
    ).not.toContain('unknown key');
  } finally {
    process.chdir(previous);
  }
}, 30000);

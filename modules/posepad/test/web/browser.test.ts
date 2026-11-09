import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import '../../../../packages/core/src/all.ts';
import { compile } from '../../../../packages/markup/src/index.ts';
import type {} from '../../../input/web/index.ts';
import type { PosePadModule } from '../../core/index.ts';
const root = new URL('../../../../', import.meta.url);
const doc = JSON.parse(
  compile(readFileSync(new URL('../../examples/look.animl', import.meta.url), 'utf8')).text!,
);
for (const [name, engine, executablePath] of [
  [
    'Chromium',
    chromium,
    process.env.CHROMIUM_PATH ??
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      ),
  ],
  [
    'Firefox',
    firefox,
    process.env.FIREFOX_PATH ??
      resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
  ],
] as const)
  describe.skipIf(!existsSync(executablePath))(`posepad ${name}`, () => {
    let browser: Browser, page: Page;
    let sources: string[];
    beforeAll(async () => {
      sources = await Promise.all(
        ['index', 'bind', 'input', 'posepad', 'posepad-handle', 'canvas'].map((n) =>
          bundle(new URL(`packages/web/src/${n}.ts`, root).pathname),
        ),
      );
      browser = await engine.launch({
        executablePath,
        headless: true,
        args: name === 'Chromium' ? ['--no-sandbox'] : [],
      });
    }, 30000);
    afterAll(async () => browser?.close());
    beforeEach(async () => {
      page = await browser.newPage();
      await page.setContent(
        '<anima-icon motion="full" style="display:block;width:240px;height:240px"></anima-icon>',
      );
      for (const s of sources.slice(0, 4)) await page.addScriptTag({ type: 'module', content: s });
      await page.waitForFunction(() =>
        (
          customElements.get(
            'anima-icon',
          ) as typeof import('../../../../packages/web/src/index.ts').AnimaIcon
        )?.modules.has('posepad'),
      );
    }, 30000);
    afterEach(async () => page.close());
    it('reports missing handle support explicitly, then accepts the optional entry', async () => {
      const diagnostics = await page.evaluate(
        (d) => document.querySelector('anima-icon')!.load(d),
        doc,
      );
      expect(diagnostics).toContainEqual(
        expect.objectContaining({ code: 'posepad-handle', pointer: '/nodes/5/handle' }),
      );
      await page.addScriptTag({ type: 'module', content: sources[4]! });
      await page.waitForFunction(
        () =>
          !!(
            (
              customElements.get(
                'anima-icon',
              ) as typeof import('../../../../packages/web/src/index.ts').AnimaIcon
            ).modules.get('posepad') as PosePadModule
          )?.handles,
      );
      expect(
        await page.evaluate((d) => document.querySelector('anima-icon')!.load(d), doc),
      ).toEqual([]);
    }, 30000);
    it.each(['svg', 'canvas'])(
      'poses eyes from actual pointer drag in %s',
      async (renderer) => {
        for (const s of sources.slice(4)) await page.addScriptTag({ type: 'module', content: s });
        await page.waitForFunction(
          () =>
            !!(
              (
                customElements.get(
                  'anima-icon',
                ) as typeof import('../../../../packages/web/src/index.ts').AnimaIcon
              ).modules.get('posepad') as PosePadModule
            )?.handles,
        );
        await page.evaluate(
          ({ d, renderer }) => {
            const icon = document.querySelector('anima-icon')!;
            icon.setAttribute('renderer', renderer);
            icon.load(d);
            icon.flush();
          },
          { d: doc, renderer },
        );
        const b = await page.locator('anima-icon').boundingBox();
        await page.mouse.move(b!.x + 120, b!.y + 180);
        await page.mouse.down();
        await page.mouse.move(b!.x + 168, b!.y + 132, { steps: 4 });
        await page.mouse.up();
        await expect
          .poll(() =>
            page.evaluate(() => {
              const p = document.querySelector('anima-icon')!.player!;
              return [
                p.value('look.valueX'),
                p.value('look.valueY'),
                p.value('pupils.x'),
                p.value('pupils.y'),
              ];
            }),
          )
          .toEqual([1, -1, 1.5, -1.5]);
      },
      30000,
    );
  });

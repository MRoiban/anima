// Reproducible implementation screenshots, generated from a temp file through the real server.
// node packages/playground/test/capture.ts
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import type { AnimaIcon } from '@anima-format/web';
import { startPlayground } from '../../cli/src/playground.ts';

const dir = await mkdtemp(join(tmpdir(), 'anima-capture-'));
const file = join(dir, 'bell.animl');
const bell = await readFile(new URL('../../../examples/bell.animl', import.meta.url), 'utf8');
await writeFile(file, bell);
const host = await startPlayground({ file, port: 0 });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    resolve(
      homedir(),
      '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    ),
  headless: true,
});
const out = new URL('../../../design/playground/impl/', import.meta.url);
await mkdir(out, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(host.url);
  await page.waitForFunction(() => !!document.querySelector<AnimaIcon>('#icon')?.player);
  for (const [width, height] of [
    [1440, 900],
    [1000, 800],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const state of ['valid', 'errors', 'dark']) {
      await page.goto(host.url);
      await page.waitForFunction(() => !!document.querySelector<AnimaIcon>('#icon')?.player);
      if (state === 'errors') {
        await page
          .locator('#source')
          .fill(
            bell
              .replace('fill="ink"', 'fil="ink"')
              .replace('0.95      -1.1459  sway', '0.95      -1.1459  swy'),
          );
        await page.waitForFunction(() =>
          document.querySelector('#status')!.classList.contains('err'),
        );
        await page.locator('#source').evaluate((e) => {
          e.scrollTop = 360;
          e.dispatchEvent(new Event('scroll'));
        });
      }
      if (state === 'dark') await page.locator('#theme').click();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: new URL(`${width}-${state}.png`, out).pathname });
      console.log(
        `${width}×${height} ${state}; scrollWidth=${await page.evaluate(() => document.documentElement.scrollWidth)}`,
      );
    }
  }
} finally {
  await browser.close();
  await host.close();
  await rm(dir, { recursive: true, force: true });
}

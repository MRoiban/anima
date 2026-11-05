import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, firefox, type Browser, type BrowserType, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AnimaIcon } from '@anima-format/web';
import { startPlayground, type PlaygroundServer } from '../../cli/src/playground.ts';
import { buildPlayground } from '../../../tools/build-playground.ts';

const bell = await readFile(new URL('../../../examples/bell.animl', import.meta.url), 'utf8');
const BROWSERS: [string, BrowserType, string | undefined][] = [
  [
    'Chromium',
    chromium,
    process.env.CHROMIUM_PATH ??
      [
        resolve(
          homedir(),
          '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
        ),
        chromium.executablePath(),
      ].find(existsSync),
  ],
  [
    'Firefox',
    firefox,
    process.env.FIREFOX_PATH ??
      [
        resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
        firefox.executablePath(),
      ].find(existsSync),
  ],
];
for (const [name, type, executablePath] of BROWSERS) {
  if (!executablePath) console.warn(`SKIP playground in ${name}: set ${name.toUpperCase()}_PATH`);
  describe.skipIf(!executablePath)(`playground in ${name}`, () => {
    let browser: Browser,
      page: Page,
      host: PlaygroundServer,
      dir: string,
      file: string,
      html: string;
    beforeAll(async () => {
      html = await buildPlayground();
      browser = await type.launch({ executablePath, headless: true });
    }, 30000);
    afterAll(async () => {
      await browser?.close();
    });
    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'anima-playground-'));
      file = join(dir, 'bell.animl');
      await writeFile(file, bell);
      host = await startPlayground({ file, port: 0, html });
      page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'no-preference',
        colorScheme: 'light',
      });
      page.setDefaultTimeout(6000);
      await page.goto(host.url);
      await page.waitForFunction(() => !!document.querySelector<AnimaIcon>('#icon')?.player);
    });
    afterEach(async () => {
      await page?.close();
      await host?.close();
      await rm(dir, { recursive: true, force: true });
    });
    const iconValue = (address: string) =>
      page.evaluate((a) => document.querySelector<AnimaIcon>('#icon')!.values()[a], address);
    it('renders the real icon, reports exact typo position, keeps last stage and recovers on edit', async () => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      expect(await page.locator('#icon svg path').count()).toBeGreaterThan(0);
      const before = await iconValue('swing.rotate');
      await page.locator('#source').fill(bell.replace('fill="ink"', 'fil="ink"'));
      await page.waitForFunction(
        () => document.querySelector('#status')!.textContent === '2 errors',
      );
      expect(await page.locator('#diags').textContent()).toContain('bell.animl:32:51');
      expect(await page.locator('#diags').textContent()).toContain('unknown-attribute');
      expect(await page.locator('#tilewrap').getAttribute('class')).toContain('broken');
      expect(await page.locator('#icon svg path').count()).toBeGreaterThan(0);
      expect(await iconValue('swing.rotate')).toBe(before);
      await page.locator('#diags button').first().click();
      expect(
        await page
          .locator('#source')
          .evaluate((e) =>
            (e as HTMLTextAreaElement).value.slice(
              (e as HTMLTextAreaElement).selectionStart,
              (e as HTMLTextAreaElement).selectionEnd,
            ),
          ),
      ).toBe('fil');
      await page.locator('#source').fill(bell);
      await page.waitForFunction(() => document.querySelector('#status')!.textContent === 'valid');
      expect(await page.locator('#diags').textContent()).toContain(
        'No problems. Every change is compiled as you type.',
      );
      expect(errors).toEqual([]);
    });
    it('drives inputs, highlights ringing after Fire and receives runtime events', async () => {
      await page.getByRole('switch', { name: 'hover', exact: true }).click();
      await page.waitForFunction(
        () => document.querySelector<AnimaIcon>('#icon')!.player!.get('hover') === true,
      );
      await page.waitForFunction(
        () => Number(document.querySelector<AnimaIcon>('#icon')!.values()['icon.scale']) > 1.02,
      );
      await page.getByRole('button', { name: 'Fire ring', exact: true }).click();
      await page.waitForFunction(() =>
        document
          .querySelector('[data-layer="ring"] [data-state="ringing"]')!
          .classList.contains('cur'),
      );
      expect(await page.locator('#events').textContent()).toContain('rang');
      expect(await page.locator('[data-layer="ring"] svg').getAttribute('aria-label')).toContain(
        'ringing (current)',
      );
      expect(await page.locator('[data-layer="ring"] .ed.live').count()).toBe(1);
    });
    it('saves edits with the keyboard and reloads an externally changed file', async () => {
      const changed = bell.replace('title="Bell"', 'title="Saved bell"');
      await page.locator('#source').fill(changed);
      await page.locator('#source').press('Control+s');
      await page.waitForFunction(() => document.querySelector('#saved')!.textContent === 'saved');
      expect(await readFile(file, 'utf8')).toBe(changed);
      await writeFile(file, changed.replace('Saved bell', 'Disk bell'));
      await page.waitForFunction(() => !document.querySelector<HTMLElement>('#reload')!.hidden);
      expect(await page.locator('#save').isDisabled()).toBe(true);
      await page.locator('#reload').click();
      await page.waitForFunction(() =>
        document.querySelector<HTMLTextAreaElement>('#source')!.value.includes('Disk bell'),
      );
    });
    it('scrubs the timeline over rest, moves playhead and restores live inputs', async () => {
      const initial = await iconValue('swing.rotate');
      await page.locator('#scrub').evaluate((e) => {
        const input = e as HTMLInputElement;
        input.value = '0.116667';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(await page.locator('#mode').textContent()).toContain('scrubbing — inputs paused');
      expect(await page.getByRole('switch', { name: 'hover', exact: true }).isDisabled()).toBe(
        true,
      );
      expect(await page.locator('#icon').isVisible()).toBe(false);
      expect(
        await page.evaluate(
          () => document.querySelector<AnimaIcon>('#sample')!.values()['swing.rotate'],
        ),
      ).not.toBe(initial);
      expect(await page.locator('#time').textContent()).toBe('0.117 s');
      const left = await page.locator('#ph').evaluate((e) => (e as HTMLElement).style.left);
      await page.getByRole('button', { name: 'Step one frame', exact: true }).click();
      expect(await page.locator('#ph').evaluate((e) => (e as HTMLElement).style.left)).not.toBe(
        left,
      );
      await page.locator('#mode').click();
      expect(await page.locator('#icon').isVisible()).toBe(true);
      expect(await page.getByRole('switch', { name: 'hover', exact: true }).isDisabled()).toBe(
        false,
      );
    });
    it('supports real stage pointer interaction and reduced-motion reload', async () => {
      await page.locator('#icon').hover();
      await page.waitForFunction(
        () => document.querySelector<AnimaIcon>('#icon')!.player!.get('hover') === true,
      );
      await page.locator('#icon').click();
      await page.waitForFunction(() =>
        document
          .querySelector('[data-layer="ring"] [data-state="ringing"]')!
          .classList.contains('cur'),
      );
      await page.locator('#motion').click();
      expect(
        await page.evaluate(
          () => document.querySelector<AnimaIcon>('#icon')!.player!.reducedMotion,
        ),
      ).toBe(true);
      await page.getByRole('button', { name: 'Fire ring', exact: true }).click();
      await page.waitForFunction(
        () => document.querySelector<AnimaIcon>('#icon')!.player!.states().ring === 'rested',
      );
      expect(await iconValue('dot.scale')).toBe(1);
    });
    it('opens the built-in example without write access', async () => {
      await host.close();
      host = await startPlayground({ port: 0, html });
      await page.goto(host.url);
      await page.waitForFunction(() => !!document.querySelector<AnimaIcon>('#icon')?.player);
      expect(await page.locator('#save').isDisabled()).toBe(true);
      expect(await page.locator('#saved').textContent()).toBe('read-only example');
      await page.locator('#source').fill(bell.replace('title="Bell"', 'title="Scratch bell"'));
      await page.locator('#source').press('Control+s');
      expect(await (await fetch(host.url + '/api/file')).json()).toMatchObject({
        source: bell,
        writable: false,
      });
    });
    it('formats, exposes compiled JSON, changes theme and fits phone/tablet layouts', async () => {
      await page
        .locator('#source')
        .fill(bell.replace('<bool name="down"/>', '<bool    name="down"   />'));
      await page.locator('#source').press('Shift+Alt+f');
      expect(await page.locator('#source').inputValue()).toContain('<bool name="down"/>');
      await page.locator('#ani').click();
      expect(await page.locator('#source').inputValue()).toContain('"anima": "0.1"');
      expect(await page.locator('#source').getAttribute('readonly')).not.toBeNull();
      await page.locator('#animl').click();
      await page.locator('#theme').click();
      expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');
      for (const [width, height] of [
        [1000, 800],
        [390, 844],
      ]) {
        await page.setViewportSize({ width, height });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      }
    });
  });
}

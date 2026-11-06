/// <reference lib="dom" />
// Development-only oracle adapter. Uses the shipped Canvas renderer, opaque white at 240px.
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
let harness: Promise<string> | undefined;
export async function renderCanvas(doc: object, script: string, target: URL) {
  harness ??= build({
    entryPoints: ['modules/canvas/test/web/harness.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2022',
  }).then((r) => r.outputFiles[0]!.text);
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH ??
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      ),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 600, height: 600 },
      deviceScaleFactor: 1,
    });
    await page.setContent('<style>body{margin:0;background:white}</style>');
    await page.addScriptTag({ type: 'module', content: await harness });
    await page.waitForFunction(() => !!window.canvasTest);
    await page.evaluate(async ({ doc, script }) => window.canvasTest.mount(doc, 'canvas', script), {
      doc,
      script,
    });
    const errors = await page.evaluate(() => window.canvasTest.errors);
    if (errors.length) throw Error(JSON.stringify(errors));
    writeFileSync(target, await page.locator('anima-icon').locator('canvas').screenshot());
  } finally {
    await browser.close();
  }
}

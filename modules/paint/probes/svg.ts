// Development evidence for portable SVG alternatives; no runtime code or tolerance changes.
import { chromium, firefox } from 'playwright-core';
import { PNG } from 'pngjs';
import { toPNG } from '../../../packages/cli/src/render.ts';
import { writeFileSync } from 'node:fs';
const results: object[] = [];
const metric = (a: PNG, b: PNG) => {
  let max = 0,
    over = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    let d = 0;
    for (let j = 0; j < 4; j++) d = Math.max(d, Math.abs(a.data[i + j]! - b.data[i + j]!));
    max = Math.max(max, d);
    if (d > 16) over++;
  }
  return { max, over, percent: (100 * over) / (a.width * a.height) };
};
const svg = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 20 20" style="isolation:isolate"><rect width="20" height="20" fill="#204060"/>${content}</svg>`;
const front = (attrs = '') =>
  `<g ${attrs}><rect x="4" y="4" width="12" height="12" fill="#804020" style="mix-blend-mode:screen"/></g>`;
const variants = {
  plain: front(),
  transform: front('transform="translate(0)"'),
  portable:
    '<g style="mix-blend-mode:screen"><g transform="translate(0)"><rect x="4" y="4" width="12" height="12" fill="#804020"/></g></g>',
  plus: '<rect x="4" y="4" width="12" height="12" fill="#804020" style="mix-blend-mode:plus-lighter"/>',
  explicitArithmetic:
    '<defs><rect id="back" width="20" height="20" fill="#204060"/><filter id="explicit" filterUnits="userSpaceOnUse" x="0" y="0" width="20" height="20" color-interpolation-filters="sRGB"><feImage href="#back" x="0" y="0" width="20" height="20" result="backdrop"/><feComposite in="SourceGraphic" in2="backdrop" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/></filter></defs><rect x="4" y="4" width="12" height="12" fill="#804020" filter="url(#explicit)"/>',
  arithmetic:
    '<defs><filter id="add" x="-1" y="-1" width="3" height="3" color-interpolation-filters="sRGB"><feComposite in="SourceGraphic" in2="BackgroundImage" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/></filter></defs><rect x="4" y="4" width="12" height="12" fill="#804020" filter="url(#add)"/>',
};
for (const [variant, content] of Object.entries(variants)) {
  const image = PNG.sync.read(toPNG(svg(content), 240));
  results.push({
    engine: 'resvg',
    variant,
    center: [...image.data.subarray((120 * 240 + 120) * 4, (120 * 240 + 120) * 4 + 4)],
  });
}
for (const [name, engine, path] of [
  [
    'chromium',
    chromium,
    '/home/jarvis/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['firefox', firefox, '/home/jarvis/.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const) {
  const browser = await engine.launch({ headless: true, executablePath: path });
  try {
    const page = await browser.newPage();
    for (const [variant, content] of Object.entries(variants)) {
      await page.setContent(svg(content));
      const image = PNG.sync.read(await page.locator('svg').screenshot());
      results.push({
        engine: name,
        variant,
        center: [...image.data.subarray((120 * 240 + 120) * 4, (120 * 240 + 120) * 4 + 4)],
      });
    }
    await page.setContent('<canvas width="240" height="240"></canvas>');
    await page.evaluate(() => {
      const c = document.querySelector('canvas')!.getContext('2d')!;
      const g = c.createConicGradient(0, 120, 120);
      g.addColorStop(0, '#4263eb');
      g.addColorStop(1, '#d97757');
      c.fillStyle = g;
      c.fillRect(0, 0, 240, 240);
    });
    const reference = PNG.sync.read(await page.locator('canvas').screenshot());
    for (const wedges of [64, 256, 1024]) {
      let content = '';
      for (let j = 0; j < wedges; j++) {
        const a = (j * 2 * Math.PI) / wedges,
          b = ((j + 1) * 2 * Math.PI) / wedges,
          t = (j + 0.5) / wedges;
        const color = [66 + 151 * t, 99 + 20 * t, 235 - 148 * t].map(Math.round);
        content += `<path d="M10 10L${10 + 30 * Math.cos(a)} ${10 + 30 * Math.sin(a)}L${10 + 30 * Math.cos(b)} ${10 + 30 * Math.sin(b)}Z" fill="rgb(${color.join(',')})"/>`;
      }
      const markup = svg(content);
      await page.setContent(markup);
      results.push({
        engine: name,
        wedges,
        ...metric(PNG.sync.read(await page.locator('svg').screenshot()), reference),
      });
      if (name === 'chromium')
        results.push({
          engine: 'resvg-vs-chromium-conic',
          wedges,
          ...metric(PNG.sync.read(toPNG(markup, 240)), reference),
        });
    }
  } finally {
    await browser.close();
  }
}
writeFileSync('modules/paint/probes/svg.json', JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results));

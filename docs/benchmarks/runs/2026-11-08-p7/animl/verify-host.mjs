import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const dir = 'docs/benchmarks/runs/2026-11-08-p7/animl';
const server = createServer(async (req, res) => {
  try {
    const path = resolve('.' + decodeURIComponent(req.url.split('?')[0]));
    if (!path.startsWith(process.cwd() + '/')) throw new Error('outside workspace');
    const types = { '.js': 'text/javascript', '.html': 'text/html', '.ttf': 'font/ttf' };
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({
  executablePath:
    '/home/jarvis/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/${dir}/host.html`);
  await page.waitForFunction(() => window.sceneReady);
  await page.waitForTimeout(1000);
  const evidence = [];
  for (const [fit, width, height] of [
    ['contain', 480, 360],
    ['layout', 480, 360],
    ['layout', 600, 300],
  ]) {
    await page.evaluate(
      ({ fit, width, height }) => {
        const icon = document.querySelector('anima-icon');
        icon.fit = fit;
        icon.style.width = width + 'px';
        icon.style.height = height + 'px';
      },
      { fit, width, height },
    );
    await page.waitForTimeout(100);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    evidence.push(
      await page.evaluate(() => {
        const icon = document.querySelector('anima-icon');
        const svg = icon.shadowRoot.querySelector('svg');
        const rects = [...svg.querySelectorAll('rect')].map((rect) => {
          const box = rect.getBBox(),
            screen = rect.getBoundingClientRect(),
            m = rect.getScreenCTM();
          return {
            fill: rect.getAttribute('fill'),
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            screen: { x: screen.x, y: screen.y, width: screen.width, height: screen.height },
            matrix: [m.a, m.b, m.c, m.d, m.e, m.f],
          };
        });
        return {
          fit: icon.fit,
          size: icon.size,
          host: { width: icon.clientWidth, height: icon.clientHeight },
          viewBox: svg.getAttribute('viewBox'),
          rects,
        };
      }),
    );
  }
  if (errors.length) throw new Error(errors.join('; '));
  const [contain, layout480, layout600] = evidence;
  const near = (a, b) => Math.abs(a - b) < 0.001;
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  assert(
    near(contain.rects[0].screen.width, 480) && near(contain.rects[0].screen.height, 360),
    'contain card fits 480x360',
  );
  assert(
    near(contain.rects[0].matrix[0], 12) && near(contain.rects[0].matrix[3], 12),
    'uniform 12x contain scale',
  );
  for (const record of [layout480, layout600]) {
    const [card, , row, c1, c2, c3] = record.rects;
    assert(
      near(card.box.width, record.host.width) && near(card.box.height, record.host.height),
      'card reflows to host',
    );
    assert(near(row.box.width, record.host.width - 3), 'row spans padded inner width');
    assert(
      near(c2.box.width, row.box.width - c1.box.width - c3.box.width - 1),
      'fill chip consumes remaining width',
    );
    assert(
      near(card.matrix[0], 1) && near(card.matrix[3], 1),
      'layout fit uses one pixel per unit',
    );
  }
  await writeFile(
    `${dir}/host-02.json`,
    JSON.stringify({ evidence, errors, assertions: 10, status: 'passed' }, null, 2) + '\n',
  );
  console.log(
    'Host verification passed: contain 480x360, layout 480x360, layout 600x300 (10 assertions).',
  );
} finally {
  await browser.close();
  server.close();
}

/// <reference lib="dom" />
import { accessSync, constants, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { findProject } from './project.ts';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
export async function doctor(cwd = process.cwd()) {
  const { firefox, chromium, devices } = await import('playwright-core');
  const checks: { name: string; pass: boolean; message: string; hint: string }[] = [];
  checks.push({
    name: 'authentication',
    pass: true,
    message: 'not applicable: Anima has no accounts',
    hint: 'no authentication required',
  });
  try {
    const project = findProject(cwd);
    checks.push({
      name: 'project',
      pass: true,
      message: project?.file ?? 'no anima.json (optional)',
      hint: 'create anima.json to configure this project',
    });
  } catch (e) {
    checks.push({
      name: 'project',
      pass: false,
      message: (e as Error).message,
      hint: 'repair anima.json; run a project command for its field pointer',
    });
  }
  const port = await new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(4519, '127.0.0.1', () => server.close(() => resolve(true)));
  });
  checks.push({
    name: 'port',
    pass: port,
    message: '127.0.0.1:4519',
    hint: 'stop the process using port 4519 or choose another playground --port',
  });
  try {
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
      const context = await browser.newContext({ ...devices['iPhone 13'] });
      const page = await context.newPage();
      const pass = await page.evaluate(() => innerWidth > 0 && navigator.maxTouchPoints > 0);
      checks.push({
        name: 'devices',
        pass,
        message: 'Chromium mobile viewport and touch emulation',
        hint: 'install a working cached Playwright Chromium',
      });
      await context.close();
    } finally {
      await browser.close();
    }
  } catch (e) {
    checks.push({
      name: 'devices',
      pass: false,
      message: (e as Error).message,
      hint: 'install cached Playwright Chromium or set CHROMIUM_PATH',
    });
  }
  const node = Number(process.versions.node.split('.')[0]);
  checks.push({
    name: 'node',
    pass: node >= 24,
    message: process.version,
    hint: 'install Node 24 or newer',
  });
  for (const [name, path] of [
    [
      'chromium',
      process.env.CHROMIUM_PATH ??
        resolve(
          homedir(),
          '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
        ),
    ],
    ['firefox', firefox.executablePath()],
  ]) {
    let pass = false;
    try {
      accessSync(path!, constants.X_OK);
      pass = true;
    } catch {
      /* unavailable */
    }
    checks.push({
      name: name!,
      pass,
      message: path!,
      hint: 'install the Playwright browser or set CHROMIUM_PATH for Chromium',
    });
  }
  const cache = process.env.XDG_CACHE_HOME ?? resolve(homedir(), '.cache');
  let writable = false;
  try {
    mkdirSync(cache, { recursive: true });
    accessSync(cache, constants.W_OK);
    const probe = mkdtempSync(resolve(cache, '.anima-doctor-'));
    rmSync(probe, { recursive: true });
    writable = true;
  } catch {
    /* inaccessible */
  }
  checks.push({
    name: 'cache',
    pass: writable,
    message: cache,
    hint: 'grant write access to the cache directory',
  });
  let repo = resolve(cwd);
  while (!(
    existsSync(resolve(repo, 'tools/modules.ts')) && existsSync(resolve(repo, 'spec/MODULES.md'))
  )) {
    const parent = dirname(repo);
    if (parent === repo) break;
    repo = parent;
  }
  if (
    existsSync(resolve(repo, 'tools/modules.ts')) &&
    existsSync(resolve(repo, 'spec/MODULES.md'))
  ) {
    const result = spawnSync(process.execPath, ['tools/modules.ts', '--check'], {
      cwd: repo,
      encoding: 'utf8',
    });
    checks.push({
      name: 'module-wiring',
      pass: result.status === 0,
      message: (result.stdout + result.stderr).trim(),
      hint: 'run node tools/modules.ts and commit generated wiring',
    });
  } else {
    checks.push({
      name: 'module-wiring',
      pass: true,
      message: 'installed package: repository wiring check not applicable',
      hint: 'run this check from an Anima source checkout to verify generated wiring',
    });
  }
  return {
    ok: checks.every((c) => c.pass),
    checks: checks.map((c) => ({ ...c, code: 'doctor-' + c.name, pointer: '/checks/' + c.name })),
  };
}

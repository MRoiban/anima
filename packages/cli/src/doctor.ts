import { accessSync, constants, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
export async function doctor(cwd = process.cwd()) {
  const { firefox } = await import('playwright-core');
  const checks: { name: string; pass: boolean; message: string; hint: string }[] = [];
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
  }
  return {
    ok: checks.every((c) => c.pass),
    checks: checks.map((c) => ({ ...c, code: 'doctor-' + c.name, pointer: '/checks/' + c.name })),
  };
}

import { afterEach, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { run } from '../src/cli.ts';

const bell = resolve(import.meta.dirname, '../../../examples/bell.ani');
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

// Rottweiler P3 R2-05: `render --frames N --audio out.wav` exports the audio too.
it('exports --audio with frame sequences', async () => {
  const d = mkdtempSync(resolve(tmpdir(), 'anima-rottweiler-p3-'));
  dirs.push(d);
  const previous = process.env.CHROMIUM_PATH;
  // Without a browser the audio mix fails explicitly instead of being skipped.
  process.env.CHROMIUM_PATH = '/missing-browser';
  const out: string[] = [];
  try {
    const code = await run(
      [
        'render',
        bell,
        '--frames',
        '2',
        '--audio',
        resolve(d, 'out.wav'),
        '-o',
        resolve(d, 'frame.png'),
        '--format=json',
      ],
      { out: (s) => out.push(s), err: (s) => out.push(s) },
    );
    expect(code).toBe(1);
    expect(JSON.parse(out.at(-1)!).diagnostics[0]).toMatchObject({
      code: 'build-encoder-unavailable',
    });
    expect(existsSync(resolve(d, 'out.wav'))).toBe(false);
  } finally {
    if (previous === undefined) delete process.env.CHROMIUM_PATH;
    else process.env.CHROMIUM_PATH = previous;
  }
}, 30_000);

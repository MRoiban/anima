import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/cli.ts';
import { compile } from '@anima-format/markup';
import { load } from '@anima-format/core';

it('CLI flattens AniML to both output formats with independent original-font path coordinates', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-flatten-p7-'));
  const messages: string[] = [];
  const io = { out: (s: string) => messages.push(s), err: (s: string) => messages.push(s) };
  try {
    for (const extension of ['ani', 'animl']) {
      const output = join(dir, 'outlined.' + extension);
      expect(
        await run(
          [
            'flatten',
            'modules/text/capabilities/text-flatten/example.animl',
            '--font',
            'sans-serif=fixtures/fonts/anima-test.ttf',
            '-o',
            output,
            '--format=json',
          ],
          io,
        ),
      ).toBe(0);
      const source = readFileSync(output, 'utf8');
      const doc = extension === 'ani' ? JSON.parse(source) : compile(source).doc!;
      expect(load(doc).diagnostics).toEqual([]);
      expect(JSON.stringify(doc.nodes)).toContain('M0.1 1.6L1 1.6L1 0.2L0.1 0.2Z');
      expect(JSON.stringify(doc.nodes)).not.toContain('"type":"text"');
    }
    expect(messages.some((s) => s.includes('wrote'))).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/cli.ts';
import { liveDocument } from '../live-document.ts';
it('tool and browser-text renders follow list text/style and typed style mutations', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-live-runs-'));
  try {
    const source = liveDocument();
    const literal = liveDocument();
    literal.nodes = [
      { ...literal.nodes[0]!, runs: [{ text: 'WXYZ', style: 'alternate' }] },
      { ...literal.nodes[1]!, runs: [{ text: 'CD', style: 'alternate' }] },
    ];
    const file = join(dir, 'case.ani'),
      control = join(dir, 'literal.ani');
    writeFileSync(file, JSON.stringify(source));
    writeFileSync(control, JSON.stringify(literal));
    for (const browser of [false, true]) {
      const flags = [
        '--font',
        'Anima Test=' + resolve('fixtures/fonts/anima-test.ttf'),
        ...(browser ? ['--browser-text'] : []),
      ];
      const actual = join(dir, `actual-${browser}.png`),
        expected = join(dir, `expected-${browser}.png`);
      const errors: string[] = [];
      const io = { out: () => {}, err: (s: string) => errors.push(s) };
      expect(
        await run(
          [
            'render',
            file,
            ...flags,
            '-e',
            'set $items.0.label "WXYZ"; set $items.0.ink "alternate"; set $style "alternate"; advance 0',
            '-o',
            actual,
          ],
          io,
        ),
        errors.join('\n'),
      ).toBe(0);
      expect(await run(['render', control, ...flags, '-o', expected], io), errors.join('\n')).toBe(
        0,
      );
      expect(readFileSync(actual)).toEqual(readFileSync(expected));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000);

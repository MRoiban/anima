import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/cli.ts';
it('CLI schema exposes placeholder spelling and tool/browser-text paint matches literal controls', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-placeholder-'));
  try {
    let output = '';
    const errors: string[] = [];
    const io = {
      out: (s: string) => {
        output += s + '\n';
      },
      err: (s: string) => errors.push(s),
    };
    expect(await run(['schema', '--json-schema'], io)).toBe(0);
    expect(output).toContain('placeholderColor');
    expect(
      await run(
        ['validate', 'modules/text-input/capabilities/text-input-placeholder/example.animl'],
        io,
      ),
      errors.join('\n'),
    ).toBe(0);
    for (const color of [undefined, '#336699']) {
      const node = {
        id: 'q',
        type: 'text',
        x: 2,
        y: 3,
        sizing: 'fixed',
        width: 10,
        height: 4,
        runs: [{ text: '', style: 's' }],
        styles: { s: { font: 'Anima Test', size: 1, fill: { color: '#123456' } } },
        textInput: { placeholder: 'Find', ...(color ? { placeholderColor: color } : {}) },
      };
      const doc = {
        anima: '0.1',
        name: 'placeholder',
        grid: 20,
        requires: ['text', 'textinput', 'focus', 'a11y'],
        nodes: [node],
      };
      const literalNode = { ...node, textInput: undefined };
      const control = {
        ...doc,
        nodes: [
          {
            ...literalNode,
            opacity: color ? 1 : 0.5,
            runs: [{ text: 'Find', style: 's' }],
            styles: { s: { ...node.styles.s, fill: { color: color ?? '#123456' } } },
          },
        ],
      };
      const file = join(dir, 'case.ani'),
        literal = join(dir, 'literal.ani');
      writeFileSync(file, JSON.stringify(doc));
      writeFileSync(literal, JSON.stringify(control));
      for (const browser of [false, true]) {
        const flags = [
          '--font',
          'Anima Test=' + resolve('fixtures/fonts/anima-test.ttf'),
          ...(browser ? ['--browser-text'] : []),
        ];
        const a = join(dir, 'actual.png'),
          b = join(dir, 'expected.png');
        expect(await run(['render', file, ...flags, '-o', a], io), errors.join('\n')).toBe(0);
        expect(await run(['render', literal, ...flags, '-o', b], io), errors.join('\n')).toBe(0);
        expect(readFileSync(a)).toEqual(readFileSync(b));
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000);

import { expect, it } from 'vitest';
import { run } from '../src/index.ts';
it('schema reports image paint spellings and surface keys without CLI-specific tables', async () => {
  const output: string[] = [];
  expect(
    await run(['schema', 'imagePaint', '--format=json'], {
      out: (s) => output.push(s),
      err: (s) => {
        throw new Error(s);
      },
    }),
  ).toBe(0);
  expect(JSON.parse(output.join('')).fields).toContainEqual(
    expect.objectContaining({ markup: 'image-width', ani: 'imageWidth', required: true }),
  );
  for (const topic of ['fill', 'group']) {
    output.length = 0;
    expect(
      await run(['schema', topic, '--format=json'], {
        out: (s) => output.push(s),
        err: (s) => {
          throw new Error(s);
        },
      }),
    ).toBe(0);
    expect(JSON.parse(output.join('')).fields).toContainEqual(
      expect.objectContaining({ ani: topic === 'fill' ? 'feather' : 'slice', feature: 'surface' }),
    );
  }
});

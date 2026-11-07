import { expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../../../packages/cli/src/cli.ts';
const lib = (radius: number) =>
  `<library name="ui"><template name="dot"><circle id="dot" cx="5" cy="5" r="${radius}" fill="#000"/></template></library>`;
it('checks and refreshes local vendored libraries, then builds the updated icon', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-library-'));
  try {
    const upstream = join(dir, 'upstream.animl'),
      vendor = join(dir, 'vendor.animl'),
      icon = join(dir, 'icon.animl');
    writeFileSync(upstream, lib(3));
    writeFileSync(vendor, lib(1));
    writeFileSync(
      icon,
      '<anima version="0.1" name="test" grid="10"><import src="vendor.animl" source="upstream.animl" as="ui"/><apply template="ui:dot"/></anima>',
    );
    const output: string[] = [];
    const io = { out: (s: string) => output.push(s), err: (s: string) => output.push(s) };
    expect(await run(['library', 'update', icon, '--check', '--format=json'], io)).toBe(1);
    expect(readFileSync(vendor, 'utf8')).toBe(lib(1));
    expect(await run(['library', 'update', icon, '--format=json'], io)).toBe(0);
    expect(readFileSync(vendor, 'utf8')).toBe(lib(3));
    expect(await run(['library', 'update', icon, '--check'], io)).toBe(0);
    expect(await run(['validate', icon], io)).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it('rejects remote sources and preflights failures without partially updating local files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-library-'));
  try {
    const vendor = join(dir, 'vendor.animl'),
      icon = join(dir, 'icon.animl');
    writeFileSync(vendor, lib(1));
    writeFileSync(join(dir, 'upstream.animl'), lib(3));
    writeFileSync(
      icon,
      '<anima version="0.1" name="test" grid="10"><import src="vendor.animl" source="upstream.animl" as="ui"/><import src="remote.animl" source="https://example.com/ui.animl" as="remote"/></anima>',
    );
    const output: string[] = [];
    expect(
      await run(['library', 'update', icon, '--format=json'], {
        out: (s) => output.push(s),
        err: (s) => output.push(s),
      }),
    ).toBe(1);
    expect(JSON.parse(output[0]!).diagnostics[0]).toMatchObject({
      code: 'library-local-only',
      pointer: '/imports',
    });
    expect(readFileSync(vendor, 'utf8')).toBe(lib(1));
    writeFileSync(
      icon,
      '<anima version="0.1" name="test" grid="10"><import src="vendor.animl" source="upstream.animl" as="ui"/></anima>',
    );
    writeFileSync(join(dir, 'upstream.animl'), '<anima/>');
    output.length = 0;
    expect(
      await run(['library', 'update', icon, '--format=json'], {
        out: (s) => output.push(s),
        err: (s) => output.push(s),
      }),
    ).toBe(1);
    expect(JSON.parse(output[0]!).diagnostics[0]).toMatchObject({
      code: 'library-source',
      pointer: '/imports',
      message: expect.any(String),
      hint: expect.any(String),
    });
    expect(readFileSync(vendor, 'utf8')).toBe(lib(1));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

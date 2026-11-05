import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { startPlayground, type PlaygroundServer } from '../../cli/src/playground.ts';

let directory: string, file: string, host: PlaygroundServer;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'anima-server-'));
  file = join(directory, 'bell.animl');
  await writeFile(file, 'initial');
});
afterEach(async () => {
  await host?.close();
  await rm(directory, { recursive: true, force: true });
});
it('serves one file, writes it, reports disk changes and prevents stale saves', async () => {
  host = await startPlayground({ file, port: 0, html: '<!doctype html><title>test</title>' });
  expect(await (await fetch(host.url)).text()).toContain('<title>test');
  const initial = await (await fetch(host.url + '/api/file')).json();
  expect(initial).toMatchObject({ source: 'initial', name: 'bell.animl', writable: true });
  const put = (source: string, revision: string) =>
    fetch(host.url + '/api/file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, revision }),
    });
  expect((await put('edited', initial.revision)).status).toBe(200);
  expect(await readFile(file, 'utf8')).toBe('edited');
  expect((await put('stale', initial.revision)).status).toBe(409);
  await writeFile(file, 'external');
  expect((await (await fetch(host.url + '/api/file')).json()).source).toBe('external');
  expect((await fetch(host.url + '/other.animl')).status).toBe(404);
  expect((await fetch(host.url + '/api/file?path=/tmp/other')).status).toBe(404);
});
it('denies cross-origin writes, DNS rebinding, unsupported bodies and defaults to read-only bell', async () => {
  host = await startPlayground({ port: 0, html: 'test' });
  const r = await (await fetch(host.url + '/api/file')).json();
  expect(r.writable).toBe(false);
  expect(r.source).toContain('name="bell"');
  expect(
    (
      await fetch(host.url + '/api/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
  ).toBe(403);
  expect(
    (await fetch(host.url + '/api/file', { headers: { Origin: 'https://evil.test' } })).status,
  ).toBe(403);
  const status = await new Promise<number | undefined>((ok) => {
    const req = request(host.url + '/api/file', { headers: { Host: 'evil.test' } }, (res) => {
      res.resume();
      ok(res.statusCode);
    });
    req.end();
  });
  expect(status).toBe(403);
});
it('uses the next free port', async () => {
  host = await startPlayground({ port: 0, html: 'test' });
  const second = await startPlayground({ port: Number(new URL(host.url).port), html: 'test' });
  try {
    expect(Number(new URL(second.url).port)).toBeGreaterThan(Number(new URL(host.url).port));
  } finally {
    await second.close();
  }
});

it('rejects non-JSON, malformed and oversized save bodies without changing the file', async () => {
  host = await startPlayground({ file, port: 0, html: 'test' });
  const original = await (await fetch(host.url + '/api/file')).json();
  const put = (body: string, contentType = 'application/json') =>
    fetch(host.url + '/api/file', {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body,
    });
  expect((await put('source', 'text/plain')).status).toBe(415);
  expect((await put('null')).status).toBe(400);
  expect((await put('{')).status).toBe(400);
  expect(
    (
      await put(
        JSON.stringify({ source: 'x'.repeat(1024 * 1024 + 1), revision: original.revision }),
      )
    ).status,
  ).toBe(400);
  expect(await readFile(file, 'utf8')).toBe('initial');
});

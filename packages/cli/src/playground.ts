// Local, single-file authoring server. No static filesystem routes and no arbitrary write path.
import { createHash } from 'node:crypto';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { basename, resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@anima-format/markup';
import { readFileSync, realpathSync } from 'node:fs';
import { buildPlayground } from '../../../tools/build-playground.ts';

export interface PlaygroundServer {
  server: Server;
  url: string;
  close(): Promise<void>;
}
const revision = (s: string) => createHash('sha256').update(s).digest('hex');

export async function startPlayground(
  options: { file?: string; port?: number; html?: string } = {},
): Promise<PlaygroundServer> {
  const file = options.file
    ? resolve(options.file)
    : new URL('../../../examples/bell.animl', import.meta.url);
  if (options.file && !options.file.endsWith('.animl'))
    throw new Error('playground opens .animl files');
  await readFile(file, 'utf8'); // Fail before binding if the file cannot be opened.
  const html = options.html ?? (await buildPlayground());
  const writable = !!options.file;
  const sourceFile = typeof file === 'string' ? file : fileURLToPath(file);
  const project = await realpath(process.cwd());
  let origin = '';
  let writing = Promise.resolve();
  const server = createServer(async (req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(body));
    };
    // Prevent cross-origin writes and DNS rebinding of the local authoring endpoint.
    if (
      req.headers.host !== origin.slice('http://'.length) ||
      (req.headers.origin && req.headers.origin !== origin)
    ) {
      send(403, { error: 'local-origin', message: 'Use the playground’s loopback URL.' });
      return;
    }
    try {
      if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(html);
        return;
      }
      if (req.url === '/api/compile' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 1024 * 1024) {
            send(413, { error: 'limit-exceeded' });
            return;
          }
        }
        const result = compile(body, {
          file: sourceFile,
          resolve: (path) => {
            const target = realpathSync(resolve(dirname(sourceFile), path));
            const rel = relative(project, target);
            if (rel === '..' || rel.startsWith('../') || isAbsolute(rel))
              throw Error('outside project directory');
            return readFileSync(target, 'utf8');
          },
        });
        send(200, { doc: result.doc, text: result.text, diagnostics: result.diagnostics });
        return;
      }
      if (req.url !== '/api/file') {
        send(404, { error: 'not-found' });
        return;
      }
      if (req.method === 'GET') {
        const source = await readFile(file, 'utf8');
        send(200, {
          source,
          revision: revision(source),
          writable,
          name: options.file ? basename(options.file) : 'examples/bell.animl',
        });
        return;
      }
      if (req.method !== 'PUT') {
        res.setHeader('Allow', 'GET, PUT');
        send(405, { error: 'method' });
        return;
      }
      if (!writable) {
        send(403, { error: 'read-only', message: 'The built-in example is read-only.' });
        return;
      }
      if (!req.headers['content-type']?.startsWith('application/json')) {
        send(415, { error: 'content-type' });
        return;
      }
      req.setEncoding('utf8');
      let body = '';
      let size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 2 * 1024 * 1024) {
          send(413, { error: 'limit-exceeded' });
          return;
        }
        body += chunk;
      }
      const data = JSON.parse(body) as { source?: unknown; revision?: unknown } | null;
      if (
        !data ||
        typeof data !== 'object' ||
        typeof data.source !== 'string' ||
        Buffer.byteLength(data.source) > 1024 * 1024 ||
        typeof data.revision !== 'string'
      ) {
        send(400, { error: 'invalid-save' });
        return;
      }
      const source = data.source;
      // Serialise saves so two tabs cannot both pass the same revision check.
      const save = writing.then(async () => {
        const current = await readFile(file, 'utf8');
        if (data.revision !== revision(current)) {
          send(409, {
            error: 'file-changed',
            message: 'The file changed on disk. Reload before saving.',
          });
          return;
        }
        await writeFile(file, source, 'utf8');
        send(200, { revision: revision(source) });
      });
      writing = save.catch(() => {});
      await save;
    } catch (e) {
      send(e instanceof SyntaxError ? 400 : 500, {
        error: 'file-io',
        message: (e as Error).message,
      });
    }
  });
  let port = options.port ?? 4519;
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('--port takes an integer from 0 to 65535');
  for (;;) {
    try {
      await new Promise<void>((ok, fail) => {
        const error = (e: NodeJS.ErrnoException) => {
          server.off('listening', ready);
          fail(e);
        };
        const ready = () => {
          server.off('error', error);
          ok();
        };
        server.once('error', error);
        server.once('listening', ready);
        server.listen(port, '127.0.0.1');
      });
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE' || port === 0 || port >= 65535)
        throw e;
      port++;
    }
  }
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}`;
  return {
    server,
    url: origin,
    close: () =>
      new Promise((ok, fail) => {
        server.close((e) => (e ? fail(e) : ok()));
        server.closeIdleConnections();
      }),
  };
}

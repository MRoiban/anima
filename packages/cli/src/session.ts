import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import type { Model } from '@anima-format/core';
import { createScriptSession, ScriptError, type ScriptOptions } from '../../core/src/script.ts';

export interface SessionIO {
  out(s: string): void;
  input?: AsyncIterable<string>;
}

/** One JSON reply per input line, including errors, without restarting the interpreter. */
export async function session(
  load: () => Model | undefined | Promise<Model | undefined>,
  io: SessionIO,
  opts: ScriptOptions = {},
): Promise<number> {
  let model = await load();
  if (!model) {
    io.out(
      JSON.stringify({
        ok: false,
        diagnostics: [
          {
            code: 'session-load',
            pointer: '',
            message: 'cannot load session document',
            hint: 'validate the file, fix diagnostics and start the session again',
          },
        ],
      }),
    );
    return 1;
  }
  let engine = createScriptSession(model, opts);
  const lines =
    io.input ?? createInterface({ input: process.stdin as Readable, crlfDelay: Infinity });
  for await (const raw of lines) {
    try {
      let cmd = raw.trim();
      if (cmd.startsWith('{')) {
        const request: unknown = JSON.parse(cmd);
        if (
          !request ||
          typeof request !== 'object' ||
          !('cmd' in request) ||
          typeof request.cmd !== 'string'
        )
          throw new ScriptError('JSON request needs a string cmd', 1);
        cmd = request.cmd;
      }
      if (cmd.includes('\n') || cmd.includes('\r'))
        throw new ScriptError('one command per request', 1);
      if (cmd === 'quit') {
        io.out(JSON.stringify({ ok: true, quit: true }));
        break;
      }
      if (cmd === 'reload') {
        const saved = model.doc.requires?.includes('data') ? engine.dataValues() : {};
        const next = await load();
        if (!next) {
          io.out(
            JSON.stringify({
              ok: false,
              diagnostics: [
                {
                  code: 'session-reload',
                  pointer: '',
                  message: 'reload failed',
                  hint: 'fix the file and retry reload',
                },
              ],
            }),
          );
          continue;
        }
        const replacement = createScriptSession(next, opts);
        const restored: string[] = [],
          skipped: string[] = [];
        for (const [path, value] of Object.entries(saved)) {
          try {
            replacement.execute(`data set ${path} ${JSON.stringify(value)}`);
            restored.push(path);
          } catch {
            skipped.push(path);
          }
        }
        replacement.execute('advance 0');
        model = next;
        engine = replacement;
        io.out(JSON.stringify({ ok: true, reloaded: true, restored, skipped }));
        continue;
      }
      const result = engine.execute(cmd);
      io.out(JSON.stringify({ ok: result.diagnostics.length === 0, ...result }));
    } catch (error) {
      const e = error as Error & { code?: string; pointer?: string; hint?: string };
      io.out(
        JSON.stringify({
          ok: false,
          diagnostics: [
            {
              code: e.code ?? 'session-command',
              pointer: e.pointer ?? '',
              message: e.message,
              hint: e.hint ?? 'send a script command or {"cmd":"…"}',
            },
          ],
        }),
      );
    }
  }
  return 0;
}

import { parseXml } from '../../markup/src/xml.ts';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface Project {
  file: string;
  entry?: string;
  sources?: string[];
  presets?: Record<string, Record<string, string | number | boolean | string[]>>;
  out?: string;
}
export function projectError(pointer: string, message: string): Error {
  return Object.assign(new Error(message), {
    code: 'project-configuration',
    pointer,
    hint: 'check anima.json: entry, sources, presets and out; paths are relative to the project file',
  });
}
export function findProject(cwd = process.cwd()): Project | undefined {
  let dir = resolve(cwd);
  for (;;) {
    const file = resolve(dir, 'anima.json');
    if (existsSync(file)) {
      let p: unknown;
      try {
        p = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        throw projectError('', 'invalid anima.json JSON');
      }
      if (!p || typeof p !== 'object' || Array.isArray(p))
        throw projectError('', 'project must be an object');
      const value = p as Record<string, unknown>;
      for (const key of Object.keys(value))
        if (!['entry', 'sources', 'presets', 'out'].includes(key))
          throw projectError('/' + key, 'unknown project field ' + key);
      for (const key of ['entry', 'out'])
        if (value[key] !== undefined && (typeof value[key] !== 'string' || !value[key]))
          throw projectError('/' + key, key + ' must be a nonempty path');
      if (
        value.sources !== undefined &&
        (!Array.isArray(value.sources) ||
          value.sources.some((s) => typeof s !== 'string' || !s.endsWith('.animl')))
      )
        throw projectError('/sources', 'sources must be AniML library paths');
      const allowed = new Set([
        'component',
        'fit',
        'viewport',
        'scale',
        'size',
        'at',
        'dark',
        'color',
        'current',
        'background',
        'sheet',
        'over',
        'reduced-motion',
      ]);
      if (value.presets !== undefined) {
        if (!value.presets || typeof value.presets !== 'object' || Array.isArray(value.presets))
          throw projectError('/presets', 'presets must be an object');
        for (const [name, preset] of Object.entries(value.presets)) {
          if (!preset || typeof preset !== 'object' || Array.isArray(preset))
            throw projectError('/presets/' + name, 'preset must be an object');
          for (const [key, v] of Object.entries(preset)) {
            const valid = ['dark', 'reduced-motion'].includes(key)
              ? typeof v === 'boolean'
              : key === 'color'
                ? Array.isArray(v) && v.every((x) => typeof x === 'string')
                : typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
            if (!allowed.has(key) || !valid)
              throw projectError('/presets/' + name + '/' + key, 'invalid render preset option');
          }
        }
      }
      return {
        ...value,
        file,
        entry: value.entry ? resolve(dir, value.entry as string) : undefined,
        sources: (value.sources as string[] | undefined)?.map((s) => resolve(dir, s)),
        out: value.out ? resolve(dir, value.out as string) : undefined,
      } as Project;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}
/** Sources are ordinary AniML libraries, imported using their declared names as namespaces. */
export function projectSource(file: string): string {
  const text = readFileSync(file, 'utf8');
  const p = findProject();
  if (p?.entry !== resolve(file) || !p.sources?.length) return text;
  if (!file.endsWith('.animl'))
    throw projectError('/sources', 'multi-file projects require an AniML entry');
  const imports = p.sources
    .map((source) => {
      const lib = readFileSync(source, 'utf8');
      const root = parseXml(lib).doc.root;
      const name =
        root?.name === 'library' ? root.attrs.find((a) => a.name === 'name')?.value : undefined;
      if (!name || !/^[a-zA-Z][\w-]*$/.test(name))
        throw projectError('/sources', 'source must be a named AniML library');
      const escaped = source.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
      return `<import src="${escaped}" as="${name}"/>`;
    })
    .join('\n');
  const root = parseXml(text).doc.root;
  if (root?.name !== 'anima') throw projectError('/entry', 'project entry must have an anima root');
  let end = root.at.offset,
    quote = '';
  for (; end < text.length; end++) {
    const c = text[end]!;
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '>') break;
  }
  const tag = text.slice(root.at.offset, end + 1);
  if (tag.endsWith('/>'))
    return (
      text.slice(0, root.at.offset) +
      tag.slice(0, -2) +
      '>' +
      imports +
      '</anima>' +
      text.slice(end + 1)
    );
  return text.slice(0, end + 1) + '\n' + imports + text.slice(end + 1);
}

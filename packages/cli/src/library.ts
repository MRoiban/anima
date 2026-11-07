// Vendoring is explicit and local. Read and validate every source before writing any destination.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseXml } from '../../markup/src/xml.ts';
export interface LibraryUpdate {
  source: string;
  file: string;
  changed: boolean;
}
export function updateLibraries(file: string, check = false): LibraryUpdate[] {
  const seen = new Set<string>(),
    pending = new Map<string, { source: string; text: string }>();
  const local = (path: string, base: string) => {
    if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(path))
      throw Object.assign(new Error('library update accepts local files only'), {
        code: 'library-local-only',
        pointer: '/imports',
        hint: 'use a local source path on the import',
      });
    return resolve(dirname(base), path);
  };
  const visit = (file: string, text = readFileSync(file, 'utf8')) => {
    if (seen.has(file)) return;
    seen.add(file);
    const parsed = parseXml(text);
    if (
      parsed.errors.length ||
      !parsed.doc.root ||
      !['anima', 'library'].includes(parsed.doc.root.name)
    )
      throw Object.assign(new Error('invalid AniML library source ' + file), {
        code: 'library-source',
        pointer: '',
        hint: 'fix the XML and use an anima or library root',
      });
    for (const el of parsed.doc.root.children) {
      if (el.kind !== 'element' || el.name !== 'import') continue;
      const attr = (name: string) => el.attrs.find((a) => a.name === name)?.value;
      const src = attr('src');
      if (!src) continue;
      const destination = local(src, file),
        source = attr('source');
      if (!source) {
        visit(destination);
        continue;
      }
      const upstream = local(source, file),
        next = readFileSync(upstream, 'utf8'),
        lib = parseXml(next);
      if (lib.errors.length || lib.doc.root?.name !== 'library')
        throw Object.assign(new Error('upstream must be an AniML library ' + upstream), {
          code: 'library-source',
          pointer: '/imports',
          hint: 'point source at a valid local library',
        });
      const previous = pending.get(destination);
      if (previous && previous.source !== upstream)
        throw Object.assign(new Error('conflicting sources for ' + destination), {
          code: 'library-source',
          pointer: '/imports',
          hint: 'use one upstream per vendored file',
        });
      pending.set(destination, { source: upstream, text: next });
      // Nested vendored paths are interpreted at their installed location.
      visit(destination, next);
    }
  };
  visit(resolve(file));
  const updates = [...pending].map(([file, { source, text }]) => ({
    file,
    source,
    text,
    changed: readFileSync(file, 'utf8') !== text,
  }));
  if (!check)
    for (const update of updates) if (update.changed) writeFileSync(update.file, update.text);
  return updates.map(({ file, source, changed }) => ({ file, source, changed }));
}

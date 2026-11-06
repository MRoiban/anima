import type { Model, Value } from '../../../packages/core/src/load.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { parseHex } from '../../../packages/core/src/color.ts';
import { compare } from '../../../packages/core/src/cond.ts';
import { compiled, same } from './types.ts';
import { accepts, normalize } from './storage.ts';

/** Typed equality literals belong to data, never to the numeric bind parser. */
export function guards(model: Model): void {
  const c = compiled.get(model);
  if (!c) return;
  model.guard = (term, at, d) => {
    const ref = c.refs.get(term.a.trim());
    if (!ref) return;
    const p = ref.property,
      text = term.b.trim();
    if (!/^(?:"|#|true\b|false\b|asset\s*\()/.test(text)) return;
    let value: unknown;
    const asset = /^asset\(\s*("(?:[^"\\]|\\.)*")\s*\)$/.exec(text);
    try {
      value = asset
        ? JSON.parse(asset[1]!)
        : text.startsWith('#')
          ? parseHex(text)
          : JSON.parse(text);
    } catch {
      /* diagnosed below */
    }
    const valid =
      ['==', '!='].includes(term.op) &&
      (asset
        ? p.type === 'asset-ref' && model.doc.assets?.[String(value)]?.type === p.assetType
        : p.type !== 'asset-ref' && accepts(p, value));
    if (!valid) {
      d.err(
        'data-guard',
        at,
        V && 'literal does not match the data property or comparison',
        V &&
          'use == or != with a literal of the declared type; assets need asset("id"); triggers use a bare path',
      );
      term.test = () => false;
      return true;
    }
    const literal = normalize(p, value);
    term.test = (scope) =>
      Array.isArray(literal)
        ? same(scope.get(term.a.trim()), literal) === (term.op === '==')
        : compare(scope.get(term.a.trim())!, literal as Value, term.op);
    return true;
  };
}

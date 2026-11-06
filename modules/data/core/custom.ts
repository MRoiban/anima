import type { Model, InputM } from '../../../packages/core/src/load.ts';
import type { Diags } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { accepts } from './storage.ts';
import { type Property } from './types.ts';
export function custom(model: Model, d: Diags): void {
  if (!model.doc.requires?.includes('data')) return;
  for (const [i, node] of model.nodes.entries())
    for (const [name, raw] of Object.entries(node.raw.properties ?? {})) {
      const p =
        raw !== null && typeof raw === 'object'
          ? (raw as Property)
          : ({
              type:
                typeof raw === 'number' ? 'number' : typeof raw === 'boolean' ? 'bool' : 'string',
              default: raw,
            } as Property);
      const value =
        p.default ??
        (p.type === 'number'
          ? 0
          : p.type === 'bool'
            ? false
            : p.type === 'color'
              ? '#000'
              : p.type === 'enum'
                ? p.values?.[0]
                : '');
      if (
        !['number', 'bool', 'color', 'string', 'enum', 'trigger'].includes(p.type) ||
        (p.type !== 'trigger' && !accepts(p, value))
      )
        d.err(
          'data-property',
          '/nodes/' + i + '/properties/' + name,
          V && 'invalid custom property declaration',
          V && 'use number, bool, color, string, enum or trigger with a matching default',
        );
      if (p.type === 'trigger')
        model.inputs.set(node.id + '.properties.' + name, {
          name: node.id + '.properties.' + name,
          type: 'trigger',
          def: false,
          min: 0,
          max: 1,
          buffer: 0,
        } satisfies InputM);
      if (p.type === 'enum' && !p.values?.length)
        d.err(
          'data-enum',
          '/nodes/' + i + '/properties/' + name,
          V && 'custom enum needs values',
          V && 'declare nonempty enum members',
        );
    }
}

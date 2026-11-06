import type { Module } from '../../../packages/core/src/modules.ts';
import { NAME } from '../../../packages/core/src/registry.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { definition, group, options } from './registry.ts';
import { after } from '../manifest.ts';
import { converterRegistry, convertValue } from './converters.ts';
import { ConverterError, bad } from './types.ts';
import type {
  ConverterContext,
  ConverterDefinition,
  ConverterGroup,
  ConverterValue,
} from './types.ts';
import { formula } from './math.ts';
export * from './types.ts';
export * from './converters.ts';
export * from './math.ts';
export type Definitions = Record<string, ConverterDefinition | ConverterGroup>;
export function createConverterRunner(definitions: Definitions) {
  const visit = (name: string, path: string[] = []): void => {
    if (path.length > 64) bad('converter chain nesting exceeds 64', 'chain');
    if (path.includes(name))
      throw new ConverterError(
        'convert-cycle',
        `converter cycle: ${[...path, name].join(' -> ')}`,
        'chain',
      );
    const d = definitions[name];
    if (name === '$comment' || !Object.hasOwn(definitions, name))
      throw new ConverterError('convert-reference', `unknown converter ${name}`, 'chain');
    if ('chain' in d)
      for (const child of (d as ConverterGroup).chain) visit(child, [...path, name]);
  };
  for (const name of Object.keys(definitions))
    if (name !== '$comment') {
      try {
        visit(name);
      } catch (error) {
        throw Object.assign(error as Error, { converter: name });
      }
    }
  return (name: string, value: ConverterValue, ctx: ConverterContext): ConverterValue => {
    const run = (name: string, value: ConverterValue, path: string): ConverterValue => {
      const d = definitions[name];
      if (name === '$comment' || !Object.hasOwn(definitions, name))
        throw new ConverterError('convert-reference', `unknown converter ${name}`);
      if ('chain' in d)
        return (d as ConverterGroup).chain.reduce(
          (v, child, i) => run(child, v, path + '/' + i),
          value,
        );
      return convertValue((d as ConverterDefinition).type, value, d, {
        ...ctx,
        key: (ctx.key ?? '') + ':' + path,
      });
    };
    return run(name, value, name);
  };
}
const allowed: Record<string, string[]> = {
  range: ['from', 'to', 'clamp', 'modulo', 'reverse'],
  round: ['decimals', 'mode'],
  negate: [],
  'to-number': [],
  'to-string': [],
  'number-format': ['decimals', 'grouping'],
  'color-format': ['format'],
  pad: ['length', 'fill', 'side'],
  trim: ['mode'],
  template: ['text', 'open', 'close', 'grouping'],
  'remove-zeros': [],
  'enum-to-index': ['values'],
  'list-length': [],
  'number-to-list': ['item'],
  trigger: [],
  'degrees-to-radians': [],
  normalize: ['from'],
  formula: ['expression', 'random'],
  calculate: ['operation', 'operand', 'random'],
  interpolate: ['duration'],
};
export function validateDefinition(d: ConverterDefinition): void {
  if (typeof d.type !== 'string') bad('converter type is required', 'type');
  if (!converterRegistry.has(d.type))
    throw new ConverterError('convert-unknown-type', `unknown converter type ${d.type}`, 'type');
  for (const key of Object.keys(d))
    if (!['type', '$comment', ...(allowed[d.type] ?? [])].includes(key))
      bad(`option ${key} does not apply to ${d.type}`, key);
  if (d.type === 'formula') {
    if (typeof d.expression !== 'string') bad('expression is required', 'expression');
    formula(d.expression as string);
  }
  // Probe options using valid representative inputs; runtime input mismatches are separate.
  const representative: Record<string, ConverterValue> = {
    negate: true,
    trigger: true,
    pad: '',
    trim: '',
    template: 0,
    'remove-zeros': '0.0',
    'enum-to-index': (d.values as string[] | undefined)?.[0] ?? '',
    'list-length': [],
    'color-format': '#000',
  };
  if (d.type !== 'formula')
    convertValue(d.type, representative[d.type] ?? 0, d, { player: {}, time: 0 });
}
export const convert: Module & {
  converterRegistry: typeof converterRegistry;
  createConverterRunner: typeof createConverterRunner;
} = {
  name: 'convert',
  after,
  converterRegistry,
  createConverterRunner,
  entries: [
    {
      target: 'document',
      shapes: {
        converters: { k: 'map', key: NAME, of: { k: 'obj', p: { ...options, ...group.p } } },
      },
      elements: {
        converter: {
          shape: {
            ...definition,
            p: { name: { k: 'str', re: NAME }, ...options },
            req: ['name', 'type'],
          },
        },
        'converter-group': {
          shape: {
            ...group,
            p: { name: { k: 'str', re: NAME }, ...group.p },
            req: ['name', 'chain'],
          },
        },
      },
    },
  ],
  load(_model, raw, diag) {
    const defs = (raw.converters ?? {}) as Definitions;
    const report = (e: unknown, name: string) => {
      const error = e as Error & { code?: string; option?: string; converter?: string };
      diag.err(
        error.code ?? 'convert-options',
        ptr('/converters', error.converter ?? name) + (error.option ? '/' + error.option : ''),
        V && error.message,
        V && 'use a declared converter type, valid options and an acyclic chain',
      );
    };
    for (const [name, d] of Object.entries(defs)) {
      if (name === '$comment') continue;
      try {
        if ('chain' in d) {
          for (const key of Object.keys(d))
            if (key !== 'chain' && key !== '$comment') bad('groups accept only chain', key);
        } else validateDefinition(d as ConverterDefinition);
      } catch (e) {
        report(e, name);
      }
    }
    try {
      createConverterRunner(defs);
    } catch (e) {
      report(e, '');
    }
  },
};

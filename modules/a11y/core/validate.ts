import type { Model } from '../../../packages/core/src/load.ts';
import type { Diags } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { states } from './registry.ts';
import type { A11yConfig } from './types.ts';
export const allowed: Record<string, string> = {
  checked: 'checkbox switch radio',
  pressed: 'button',
  selected: 'tab list-item radio',
  expanded: 'button link group list-item',
  required: 'checkbox switch radio radio-group slider',
  readonly: 'checkbox switch slider',
  modal: 'dialog alert-dialog',
};
export function validate(model: Model, d: Diags) {
  const visit = (
    nodes: { a11y?: A11yConfig; children?: { a11y?: A11yConfig }[] }[],
    base: string,
  ) =>
    nodes.forEach((n, i) => {
      const p = base + '/' + i;
      if (n.children) visit(n.children, p + '/children');
      const c = n.a11y as A11yConfig | undefined;
      if (!c) return;
      const err = (code: string, key: string, message: string, hint: string) =>
        d.err(code, p + '/a11y/' + key, V && message, V && hint);
      for (const [k, v] of Object.entries(c)) {
        const input = typeof v === 'string' && model.inputs.get(v);
        const binding =
          states.includes(k) ||
          k === 'checkedMixed' ||
          k === 'activate' ||
          (k === 'value' && c.role === 'slider');
        const text = ['label', 'hint', 'value'].includes(k);
        if (typeof v === 'string' && (binding || (text && (v.startsWith('$') || input)))) {
          if (v.startsWith('$') && !model.doc.requires?.includes('data'))
            err(
              'undeclared-feature',
              k,
              'data binding needs data',
              'add "data" to requires and load the data module',
            );
          else if (!input)
            err('unknown-input', k, 'unknown semantic input', 'name a declared input or data path');
          else if (
            !(
              k === 'activate'
                ? ['bool', 'trigger']
                : states.includes(k) || k === 'checkedMixed'
                  ? ['bool']
                  : c.role === 'slider' && k === 'value'
                    ? ['number']
                    : ['string']
            ).includes(input.type)
          )
            err(
              'input-type',
              k,
              'semantic input has the wrong type',
              'use ' +
                (k === 'activate'
                  ? 'bool or trigger'
                  : binding
                    ? k === 'value'
                      ? 'number'
                      : 'bool'
                    : 'string'),
            );
          const warning = d.list.findIndex(
            (e) => e.code === 'unused-input' && e.pointer === '/inputs/' + v,
          );
          if (warning >= 0) d.list.splice(warning, 1);
        }
        if (allowed[k] && !allowed[k]!.split(' ').includes(c.role))
          err(
            'a11y-role-state',
            k,
            'state is not supported by this role',
            'allowed states: ' +
              [
                ...states.filter((s) => !allowed[s] || allowed[s]!.split(' ').includes(c.role)),
                ...(c.role === 'checkbox' ? ['checkedMixed'] : []),
              ].join(', '),
          );
      }
      for (const [key, role] of [
        ['level', 'heading'],
        ['href', 'link'],
        ['checkedMixed', 'checkbox'],
      ] as const)
        if (c[key] !== undefined && c.role !== role)
          err(
            'bad-value',
            key,
            key + ' requires ' + role,
            'use role "' + role + '" or omit ' + key,
          );
      if (c.role === 'slider' && !c.value)
        err(
          'bad-value',
          'value',
          'slider needs a bound number',
          'name a number input or data path',
        );
      if ((c.min ?? 0) >= (c.max ?? 100))
        err('bad-value', 'min', 'min must be less than max', 'set min below max');
      for (const key of ['min', 'max', 'step'])
        if (c[key as keyof A11yConfig] !== undefined && c.role !== 'slider')
          err('bad-value', key, key + ' requires slider', 'use role "slider" or omit ' + key);
    });
  visit(model.doc.nodes, '/nodes');
}

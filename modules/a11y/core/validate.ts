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
    nodes: { id?: string; a11y?: A11yConfig; children?: { id?: string; a11y?: A11yConfig }[] }[],
    base: string,
  ) =>
    nodes.forEach((n, i) => {
      const p = base + '/' + i;
      if (n.children) visit(n.children, p + '/children');
      const c = n.a11y as A11yConfig | undefined;
      if (!c) return;
      const err = (code: string, key: string, message: string | false, hint: string | false) =>
        d.err(code, p + '/a11y/' + key, V && message, V && hint);
      for (const [k, v] of Object.entries(c)) {
        const input = typeof v === 'string' && model.inputs.get(v);
        const numeric =
          k === 'level' || (k === 'value' && ['slider', 'progressbar', 'meter'].includes(c.role));
        const binding = states.includes(k) || k === 'checkedMixed' || k === 'activate' || numeric;
        const text = 'label hint value valueText'.split(' ').includes(k);
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
                  : numeric
                    ? ['number']
                    : ['string']
            ).includes(input.type)
          )
            err(
              'input-type',
              k,
              'semantic input has the wrong type',
              V &&
                'use ' +
                  (k === 'activate'
                    ? 'bool or trigger'
                    : binding
                      ? numeric
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
            V &&
              'allowed states: ' +
                [
                  ...states.filter((s) => !allowed[s] || allowed[s]!.split(' ').includes(c.role)),
                  ...(c.role === 'checkbox' ? ['checkedMixed'] : []),
                ].join(', '),
          );
      }
      for (const [keys, role] of [
        ['valueText min max', 'slider progressbar meter'],
        ['step', 'slider'],
        ['level', 'heading'],
        ['href', 'link'],
        ['checkedMixed', 'checkbox'],
      ] as const)
        for (const key of keys.split(' '))
          if (c[key as keyof A11yConfig] !== undefined && !role.split(' ').includes(c.role))
            err(
              'bad-value',
              key,
              key + ' requires ' + role,
              'use role "' + role + '" or omit ' + key,
            );
      if (['slider', 'meter'].includes(c.role) && !c.value)
        err('bad-value', 'value', 'role needs a bound number', 'name a number input or data path');
      if (
        c.controls !== undefined &&
        !model.nodes.some(
          (node) =>
            node.id !== n.id &&
            node.id === c.controls &&
            node.raw.a11y &&
            node.raw.a11y.role !== 'none',
        )
      )
        err(
          'bad-value',
          'controls',
          'controls needs a semantic node id',
          'name a node with a non-none a11y role in this component',
        );
      if ((c.min ?? 0) >= (c.max ?? 100))
        err('bad-value', 'min', 'min must be less than max', 'set min below max');
    });
  visit(model.doc.nodes, '/nodes');
}

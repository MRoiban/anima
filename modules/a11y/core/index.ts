import type { Module } from '../../../packages/core/src/modules.ts';
import { after } from '../manifest.ts';
import { entries } from './registry.ts';
import { validate } from './validate.ts';
import { install, prepare } from './runtime.ts';
export * from './types.ts';
export { semanticDiff } from './runtime.ts';
export const a11y: Module = {
  name: 'a11y',
  after,
  entries,
  init(modules, shared) {
    install(shared.Player, modules);
    return {
      ...a11y,
      init: undefined,
      resolve(model) {
        prepare(model, modules.has('focus'));
      },
    };
  },
  load(model, _raw, d) {
    validate(model, d);
  },
};

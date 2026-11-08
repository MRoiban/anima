import type { Module } from '../../../packages/core/src/modules.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { installPaintedBounds } from './bounds.ts';
import { installTextSemantics } from './text.ts';
import { after } from '../manifest.ts';
import { entries } from './registry.ts';
import { validate } from './validate.ts';
import { install, prepare, runtime } from './runtime.ts';
export * from './types.ts';
export const a11y: Module & { runtime: typeof runtime } = {
  name: 'a11y',
  runtime,
  after,
  entries,
  init(modules, shared) {
    install(shared.Player, modules);
    if (V) {
      installTextSemantics(runtime, modules);
      installPaintedBounds(runtime);
    }
    return {
      ...a11y,
      init: undefined,
      resolve(model) {
        prepare(model);
      },
    };
  },
  load(model, _raw, d) {
    validate(model, d);
  },
};

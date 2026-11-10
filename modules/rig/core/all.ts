import type { Module } from '../../../packages/core/src/modules.ts';
import { rig as base, type RigModule } from './index.ts';
import { installOrigin } from './origin.ts';

export const rig: Module = {
  ...base,
  init(registry, shared) {
    const active = (base.init?.call(base, registry, shared) ?? base) as RigModule;
    installOrigin(active.origin);
    return active;
  },
};

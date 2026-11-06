import type { Module } from '../../../packages/core/src/modules.ts';
import type { DataModule } from '../../data/core/index.ts';
import { after } from '../manifest.ts';
import { install, observe } from './api.ts';
export * from './api.ts';
export const host: Module = {
  name: 'host',
  after,
  entries: [],
  init(registry, shared) {
    const data = registry.get('data') as DataModule | undefined;
    install(shared, (player) => data?.dataState(player));
    return host;
  },
  load: observe,
};

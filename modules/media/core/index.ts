import type { Module } from '../../../packages/core/src/modules.ts';
import { after } from '../manifest.ts';
// Media consumption is host IO only; declarations remain owned by assets.
export const media: Module = { name: 'media', after, entries: [] };

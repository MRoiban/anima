import type { Module } from '../../../packages/core/src/modules.ts';
import { after } from '../manifest.ts';
// TODO: compose capability registry entries and pure hooks here.
export const ik: Module = { name: 'ik', after, entries: [] };

// esbuild options for the shipped browser bundle: minified ESM with terse diagnostics
// (packages/core/src/flags.ts → VERBOSE = false).
import type { BuildOptions, Plugin } from 'esbuild';

const terse: Plugin = {
  name: 'anima-terse',
  setup(b) {
    b.onLoad({ filter: /packages[\\/]core[\\/]src[\\/]flags\.ts$/ }, () => ({
      contents: 'export const VERBOSE = false;',
      loader: 'ts',
    }));
  },
};

export const browserBuild = (entry: string): BuildOptions => ({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  legalComments: 'none',
  plugins: [terse],
});

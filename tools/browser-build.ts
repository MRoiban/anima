// The shipped browser bundle: esbuild bundles core + web as ESM with terse diagnostics
// (packages/core/src/flags.ts → VERBOSE = false), then terser minifies it (about 7 % smaller
// gzipped than esbuild alone). Property names are not mangled: it saved under 200 bytes and breaks
// string-keyed tables.

import { type BuildOptions, type Plugin, build } from 'esbuild';
import { minify } from 'terser';

const terse: Plugin = {
  name: 'anima-terse',
  setup(b) {
    b.onLoad({ filter: /packages[\\/]core[\\/]src[\\/]flags\.ts$/ }, () => ({
      contents: 'export const VERBOSE = false;',
      loader: 'ts',
    }));
  },
};

/** Build the minified browser bundle for an entry point. */
export async function bundle(
  entry: string | NonNullable<BuildOptions['stdin']>,
  verbose = false,
): Promise<string> {
  const r = await build({
    ...(typeof entry === 'string' ? { entryPoints: [entry] } : { stdin: entry }),
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
    legalComments: 'none',
    write: false,
    plugins: verbose ? [] : [terse],
  });
  const out = await minify(r.outputFiles[0]!.text, {
    module: true,
    ecma: 2020,
    compress: { passes: 3, unsafe_arrows: true, unsafe_methods: true, pure_getters: true },
    format: { comments: false },
  });
  return out.code!;
}

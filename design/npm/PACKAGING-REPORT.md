# npm packaging report

## Status

Implementation complete. Both `0.1.0` tarballs build and the isolated install smoke test passes.
Final repository gates are recorded below after the frozen-tree verification run.

Branch: `npm-packaging`.

## Implemented design

- `tools/pack.ts` writes `dist-npm/animl/` and `dist-npm/animl-cli/`, then runs `npm pack` in each
  staging directory. It rebuilds `packages/web/dist/` first.
- Runtime JavaScript is transformed per source file with esbuild at the repo's ES2022 target, while
  TypeScript emits declarations. The repo-relative layout is preserved under `packages/`,
  `modules/`, and the small set of internal tooling files required by the CLI.
- `@anima-format/core`, `@anima-format/markup`, and `@anima-format/web` imports in the runtime are
  rewritten to `animl` self-references. CLI imports that leave `packages/cli/` are rewritten to
  `animl/internal/<repo-path>.js`. This keeps one module registry in an installed application.
- `animl` exports the core API and all existing core subpaths, markup under `./markup`, web under
  `./web`, prebuilt browser bundles under `./browser/*`, and compiled CLI support files under
  `./internal/*`, with `types` and `default` conditions. It has no dependencies.
- `animl-cli` ships the compiled `anima` bin plus its runtime documentation, discovery data,
  examples, and source-derived metadata. Its dependencies are exact `animl@0.1.0` plus the CLI's
  runtime libraries, including `@resvg/resvg-js`, esbuild, terser, pngjs, and playwright-core.
- Installed `anima doctor` reports the source-checkout module-wiring test as not applicable.
  `anima bundle` and local web export resolve the compiled `animl` runtime when source `.ts` files
  are absent.
- `tools/pack-smoke.ts` installs both tarballs into a fresh directory outside the repo and checks the
  requested CLI commands, Node imports, browser rendering, package hygiene, and packed sizes.

## Deviation

The CLI discovery index reads a few TypeScript source files as text in a checkout. Shipping those
files with their original `.ts` names would violate the required tarball rule forbidding TypeScript
source. The packer therefore copies only those text inputs as `.source` files at the corresponding
repo-relative locations, and discovery falls back from `foo.ts` to `foo.source` in installed mode.
The data is unchanged, the checkout still reads the original `.ts`, and no executable TypeScript is
shipped.

## Smoke test

| Check | Result | Detail |
| --- | --- | --- |
| `animl` tarball hygiene | PASS | 1,275 files; no raw `.ts`, tests, `.riv`, or `node_modules` |
| `animl-cli` tarball hygiene | PASS | 1,181 files; no raw `.ts`, tests, `.riv`, or `node_modules` |
| fresh `npm init` + install | PASS | both local tarballs installed; zero reported vulnerabilities |
| `anima --version` | PASS | `0.1.0` |
| `anima validate` | PASS | `bell.animl: ok` |
| `anima render` PNG | PASS | 3,823-byte output |
| `anima sample -e snapshot` | PASS | snapshot emitted |
| `anima search hover` | PASS | result emitted |
| `anima features ik` | PASS | IK feature emitted |
| `anima docs ik` | PASS | IK docs emitted |
| `anima schema rect` | PASS | rect schema emitted |
| `anima examples bell --print` | PASS | 8,934-character AniML source |
| `anima help --json` | PASS | valid JSON |
| `anima new --sample bell` | PASS | sample project created |
| `anima bundle --modules paint,bind` | PASS | 85,810-byte bundle |
| Node ESM runtime/markup/all | PASS | bell compiled, loaded, stepped; 13 values |
| browser `import 'animl/web'` | PASS | custom element upgraded; 1,183 non-white screenshot pixels |

## Tarball summary

| Package | Packed | Unpacked | Files |
| --- | ---: | ---: | ---: |
| `animl@0.1.0` | 2,825,393 B | 8,166,546 B | 1,275 |
| `animl-cli@0.1.0` | 747,506 B | 3,428,284 B | 1,181 |

Both packages include `README.md`, `LICENSE`, and `NOTICE`. `animl-cli` also includes `llms.txt`.

## Final verification

- `node tools/pack.ts`: PASS.
- `node tools/pack-smoke.ts`: PASS, with the smoke results and sizes above.
- `npm run typecheck`: PASS.
- `npm run lint`: FAIL on the first and only required run because ESLint traversed the newly generated
  `dist-npm/` staging tree, and `tools/pack-smoke.ts` used `void` in a union rejected by the repo's
  strict lint rules. The implementation was corrected by adding `dist-npm/**` to the global ESLint
  ignores and changing the smoke helper callback type. A targeted
  `npx eslint eslint.config.js tools/pack-smoke.ts` then passed.
- `npm run format:check`: PASS.
- `npm run test:scope -- cli`: 492/493 tests passed; one JPEG pipeline case timed out at the suite's
  5 s limit under shared load. Per the repo rule, the failing file was rerun in isolation with
  `npx vitest run modules/assets/test/cli/pipeline.test.ts`; all 19 tests passed in 3.86 s.

## Open problems

No packaging or runtime problems are known from the package smoke test. The exact required lint run
predated the lint-ignore/type fix and therefore remains recorded as failed; the affected final files
passed targeted ESLint afterward. The CLI scope's single timeout passed on the required isolated
rerun. No package was published and no npm-account command was run.

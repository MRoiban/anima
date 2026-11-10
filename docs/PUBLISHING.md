# Publishing Anima to npm

Anima publishes two unscoped npm packages at the same version:

- `animl`: core, AniML markup, the web runtime, every optional module, declarations, and prebuilt
  browser bundles.
- `animl-cli`: the `anima` command and the documentation/example data it needs at runtime. It has an
  exact dependency on the matching `animl` version.

The private `@anima-format/*` workspace packages are source boundaries. They are not published.

## Build and verify

From a clean checkout with dependencies installed:

```sh
npm ci
npm run pack
npm run pack:smoke
```

`npm run pack` rebuilds the browser bundles, compiles the publishable TypeScript to ESM JavaScript
plus declarations, stages both packages under `dist-npm/`, and runs `npm pack` there. For version
`0.1.0` the resulting artifacts are:

```text
dist-npm/animl-0.1.0.tgz
dist-npm/animl-cli-0.1.0.tgz
```

`npm run pack:smoke` installs those exact tarballs into a fresh temporary project and exercises the
CLI, Node imports, browser runtime, and tarball-content rules. Do not publish a tarball that has not
passed this smoke test.

## Publish

Publish the runtime first because `animl-cli` depends on the exact matching runtime version. The
orchestrator should run these commands from the repository root:

```sh
npm publish dist-npm/animl-0.1.0.tgz --access public
npm publish dist-npm/animl-cli-0.1.0.tgz --access public
```

After publication, keep the tested tarballs as the release artifacts or regenerate them only from
the same commit.

## Bump the version

For a release after `0.1.0`:

1. Change `VERSION` in `tools/pack.ts` to the new version.
2. Update the version in `packages/core/package.json`, `packages/markup/package.json`,
   `packages/web/package.json`, and `packages/cli/package.json`; keep their internal development
   dependency versions aligned.
3. Run `npm install --package-lock-only --ignore-scripts` so the workspace metadata in
   `package-lock.json` matches the manifests.
4. Run `npm run pack` and `npm run pack:smoke`, then the normal repository checks.
5. Publish the newly versioned `animl` tarball first, then `animl-cli`, both with `--access public`.

The packer writes `animl-cli`'s dependency on `animl` as an exact version, never a range.

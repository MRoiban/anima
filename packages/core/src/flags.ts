/**
 * Build flag. When false (the browser build, see tools/size.ts and packages/web/build.ts),
 * diagnostics keep their code, severity and pointer but drop message and hint text, so the
 * strict loader fits the size budget. Tooling (`anima validate`) always runs with it true.
 */
export const VERBOSE: boolean = true;

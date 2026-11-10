// Contract between the command table (D-A) and the capability index (D-B); design/discovery/DESIGN.md
// D6–D7. D-B replaces the stub bodies; the types change only through the orchestrator.

export type EntryKind =
  | 'feature' // a `requires` name (module), e.g. rig, ik, input
  | 'type' // a node or object type, e.g. rect, ik, scroll-thumb
  | 'field' // a type's field, e.g. ik.bend (markup and .ani spellings)
  | 'element' // an AniML element, e.g. <copy-position>
  | 'address' // an animatable or bindable address pattern, e.g. <id>.rotate
  | 'ease' // a named ease or ease function, e.g. inOut, cubic(...)
  | 'function' // an expression function, e.g. contains(a, b)
  | 'event' // a listener event, e.g. enter, drag
  | 'script' // a `sample`/`session` script command, e.g. semantic
  | 'diagnostic' // a diagnostic code, e.g. undeclared-feature
  | 'doc' // a docs section (spec, authoring guide, module SPEC)
  | 'example' // an example scene file
  | 'capability' // a done parity row, e.g. rigging.ik
  | 'command'; // an `anima` CLI command

export interface Entry {
  kind: EntryKind;
  /** Canonical name, unique within its kind (`ik.bend`, `rigging.ik`, `examples/bell.animl`). */
  name: string;
  /** One line, plain text. */
  summary: string;
  /** Other spellings and concept words it answers to (AniML spelling, synonyms). */
  aliases?: string[];
  /** The `requires` feature that provides it, when there is one. */
  feature?: string;
  /** Parity row ids it implements or documents. */
  rows?: string[];
  /** Where to go next: `anima docs <topic>` topics. */
  docs?: string[];
  /** Example files (repo-relative) that use it. */
  examples?: string[];
  /** `anima schema <topic>` topic, when it has one. */
  schema?: string;
}

export interface SearchOptions {
  kinds?: EntryKind[];
  /** Default 10. */
  limit?: number;
}

export interface Hit {
  entry: Entry;
  /** Higher is better; only the order is meaningful. */
  score: number;
}

/** Every entry, built from the sources of truth (cached per process). */
export function index(): Entry[] {
  throw new Error('discover.index: not implemented (D-B)');
}

/** Ranked search over `index()`; empty when nothing is relevant (never pads with noise). */
export function search(_query: string, _options: SearchOptions = {}): Hit[] {
  throw new Error('discover.search: not implemented (D-B)');
}

export interface FeatureInfo {
  entry: Entry;
  /** Everything the feature provides: types, fields, elements, addresses, events, eases, functions. */
  provides: Entry[];
  /** Features it needs loaded first (manifest `after`). */
  after: string[];
}

/** All features, or one by name (`undefined` when unknown). */
export function features(): FeatureInfo[];
export function features(name: string): FeatureInfo | undefined;
export function features(_name?: string): FeatureInfo[] | FeatureInfo | undefined {
  throw new Error('discover.features: not implemented (D-B)');
}

export interface ExampleInfo {
  entry: Entry;
  /** Repo-relative path. */
  path: string;
  /** Its `requires` features. */
  requires: string[];
}

/** All examples, or those matching a feature, a file name or words (ranked). */
export function examples(_filter?: string): ExampleInfo[] {
  throw new Error('discover.examples: not implemented (D-B)');
}

/** Names close to `word` among `candidates` (D3 weighting), best first; empty below the cutoff. */
export type Suggest = (word: string, candidates: readonly string[]) => string[];

import type { SemanticNode } from './types.ts';
export const flat = (tree: SemanticNode[]): SemanticNode[] =>
  tree.flatMap((n) => [n, ...flat(n.children)]);

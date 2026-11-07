import type { SemanticNode, SemanticDiff } from '../../a11y/core/types.ts';
import { flat } from '../../a11y/core/tree.ts';
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function semanticDiff(prev: SemanticNode[], next: SemanticNode[]): SemanticDiff {
  const a = new Map(flat(prev).map((n) => [n.id, n]));
  const b = new Map(flat(next).map((n) => [n.id, n]));
  return {
    added: [...b.keys()].filter((id) => !a.has(id)),
    removed: [...a.keys()].filter((id) => !b.has(id)),
    changed: [...b].flatMap(([id, n]) => {
      const old = a.get(id);
      if (!old) return [];
      const keys = [...new Set([...Object.keys(old), ...Object.keys(n)])].filter((k) =>
        k === 'children'
          ? !equal(
              old.children.map((c) => c.id),
              n.children.map((c) => c.id),
            )
          : !equal(old[k as keyof SemanticNode], n[k as keyof SemanticNode]),
      );
      return keys.length ? [{ id, keys }] : [];
    }),
  };
}

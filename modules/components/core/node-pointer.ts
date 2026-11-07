import type { Model } from '../../../packages/core/src/load.ts';

/** JSON pointer in authored root/child order, independent of flattened node indexes. */
export function nodePointer(model: Model, index: number): string {
  const node = model.nodes[index]!;
  const siblings =
    node.parent < 0
      ? model.nodes.flatMap((n, i) => (n.parent < 0 ? [i] : []))
      : model.nodes[node.parent]!.children;
  return (
    (node.parent < 0 ? '/nodes' : nodePointer(model, node.parent) + '/children') +
    '/' +
    siblings.indexOf(index)
  );
}

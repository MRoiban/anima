// Tooling only. The player methods are installed by the registered a11y module.
import type { Player } from '../../../packages/core/src/player.ts';
import type { Snapshot } from '../../../packages/core/src/script.ts';
import type { SemanticNode } from './types.ts';
export function semanticCommand(
  p: Player,
  command: string,
  args: string[],
  output: unknown[],
  step: (dt: number) => void,
  snapshot: () => Snapshot,
): boolean {
  if (command === 'snapshot' && args.length === 1 && args[0] === '--semantics') {
    output.push({ ...snapshot(), semantics: p.semantics?.() ?? [] });
    return true;
  }
  if (command !== 'semantics' && command !== 'semantic') return false;
  if (command === 'semantics') {
    if (args.length > 1) throw Error('use semantics [id]');
    const tree = p.semantics?.() ?? [];
    const find = (nodes: SemanticNode[]): SemanticNode | undefined => {
      for (const node of nodes) {
        if (node.id === args[0]) return node;
        const found = find(node.children);
        if (found) return found;
      }
    };
    if (args.length && !find(tree)) throw Error('unknown semantic id "' + args[0] + '"');
    output.push(args.length ? find(tree) : tree);
  } else {
    if (args.length !== 2 || !['tap', 'increase', 'decrease', 'focus'].includes(args[1]!))
      throw Error('use semantic <id> tap|increase|decrease|focus');
    p.semanticAction?.(args[0]!, args[1] as import('./types.ts').SemanticAction);
    step(0);
  }
  return true;
}

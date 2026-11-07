// Tooling only. The player methods are installed by the registered a11y module.
import type { Player } from '../../../packages/core/src/player.ts';
import type { Snapshot } from '../../../packages/core/src/script.ts';
import type { SemanticNode } from './types.ts';
import { flat } from './tree.ts';
const spaceDown = new WeakMap<Player, string>();
export function semanticCommand(
  p: Player,
  command: string,
  args: string[],
  output: unknown[],
  step: (dt: number) => void,
  snapshot: () => Snapshot,
): boolean {
  // Semantic controls own native keys; the host leaves them out of generic routing.
  // Mirror that routing in tooling, without adding a browser runtime key policy.
  if (command === 'key' && p.focused && p.model.doc.requires?.includes('a11y')) {
    const tree = p.semantics?.() ?? [];
    const nodes = flat(tree),
      node = nodes.find((n) => n.id === p.focused);
    if (!node) return false;
    if (!['down', 'up', 'repeat'].includes(args[0]!) || args.length < 2 || args.length > 4)
      throw Error('use key down|up|repeat <key|Space> [shift+control+alt+meta|-] [target]');
    const mods = args[2] && args[2] !== '-' ? args[2].split('+') : [];
    if (
      mods.some((m) => !['shift', 'control', 'alt', 'meta'].includes(m)) ||
      new Set(mods).size !== mods.length
    )
      throw Error('unknown or duplicate key modifier');
    if (mods.some((m) => m !== 'shift') || (args[3] && args[3] !== node.id)) return false;
    const key = args[1] === 'Space' ? ' ' : args[1];
    const down = args[0] !== 'up';
    const arrow = ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'].indexOf(key!);
    const tabs = nodes.find(
      (n) =>
        ['tab-list', 'radio-group'].includes(n.role) && n.children.some((c) => c.id === node.id),
    );
    if (node.role === 'slider' && (arrow >= 0 || key === 'Home' || key === 'End')) {
      if (down && arrow >= 0) p.semanticAction(node.id, arrow < 2 ? 'increase' : 'decrease');
      else if (down) {
        const action = key === 'Home' ? 'decrease' : 'increase';
        // Bound the iteration count: avoid hanging on malformed host trees.
        const count = Math.ceil((node.max! - node.min!) / node.step!) + 1;
        for (let i = 0; i < count && p.semanticAction(node.id, action); i++) step(0);
      }
    } else if (tabs && (arrow >= 0 || key === 'Home' || key === 'End')) {
      if (down) {
        const order = p.focusItems?.().map((n) => n.id);
        const enabled = tabs.children
          .filter((n) => !n.states.disabled)
          .sort((a, b) => (order ? order.indexOf(a.id) - order.indexOf(b.id) : 0));
        const at = enabled.findIndex((n) => n.id === node.id);
        const target =
          key === 'Home'
            ? enabled[0]
            : key === 'End'
              ? enabled.at(-1)
              : enabled[(at + (arrow < 2 ? 1 : -1) + enabled.length) % enabled.length];
        if (target) {
          p.semanticAction(target.id, 'focus');
          if (tabs.role === 'radio-group' && target.states.checked !== true)
            p.semanticAction(target.id, 'tap');
        }
      }
    } else if (
      ['button', 'switch', 'tab', 'checkbox', 'radio', 'link'].includes(node.role) &&
      (key === ' ' || key === 'Enter')
    ) {
      // Space activates on release; links activate only on Enter, checkbox/radio only Space.
      if (key === ' ' && args[0] === 'down') spaceDown.set(p, node.id);
      const activate =
        key === ' '
          ? !down && node.role !== 'link' && spaceDown.get(p) === node.id
          : down && !['checkbox', 'radio'].includes(node.role);
      if (activate && !(node.role === 'radio' && node.states.checked === true))
        p.semanticAction(node.id, 'tap');
    } else if (key === 'Tab') return false;
    if (key === ' ' && !down) spaceDown.delete(p);
    step(0);
    return true;
  }
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

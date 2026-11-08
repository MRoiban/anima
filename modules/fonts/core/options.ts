import type { FontModule } from './index.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { LayoutInput } from '../../text/core/layout.ts';
const installed = new WeakSet<NonNullable<FontModule['prepareText']>>();
/** Resolve numeric axis slots before layout/signature calculation, including in headless tools. */
export function resolveAxes(player: Player, input: LayoutInput) {
  const i = player.model.nodes.findIndex(
    (n) => n.raw.id === (input as LayoutInput & { id: string }).id,
  );
  if (i < 0) return;
  for (const [id, style] of Object.entries(input.styles))
    if (style.axes)
      style.axes = Object.fromEntries(
        Object.entries(style.axes).map(([tag, rest]) => [
          tag,
          player.prop(i, `styles.${id}.axes.${tag}`) ?? rest,
        ]),
      ) as Record<string, number>;
}
export function installOptions(fonts: FontModule) {
  fonts.model = (node, key) => {
    const m = /^styles\.([\w-]+)\.axes\.([a-zA-Z0-9 ]{4})$/.exec(key);
    const rest = m && node.raw.styles?.[m[1]!]?.axes?.[m[2]!];
    if (String(node.type) === 'text' && typeof rest === 'number')
      return { prop: { type: 'number', feature: 'fonts' }, rest };
  };
  const prepare = fonts.prepareText;
  if (prepare && installed.has(prepare)) return;
  fonts.prepareText = (player, input) => {
    resolveAxes(player, input);
    return prepare?.(player, input);
  };
  installed.add(fonts.prepareText);
}

import type { Player } from '../../../packages/core/src/player.ts';
export function listenerValue(
  p: Player,
  r: { value: string; index?: number; control?: number; on: string },
): number | boolean {
  const m = /^gamepad-(axis|button-pressed|button-value|changed-value)(?::(\d+))?$/.exec(r.value);
  const pad = p.input().pads.get(r.index ?? 0),
    index = Number(m?.[2] ?? r.control ?? 0);
  if (m?.[1] === 'button-pressed') return pad?.buttons?.[index]?.pressed ?? false;
  return m?.[1] === 'axis' || (m?.[1] === 'changed-value' && r.on === 'gamepad-axis')
    ? (pad?.axes?.[index] ?? 0)
    : (pad?.buttons?.[index]?.value ?? 0);
}

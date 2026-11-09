import type { ConstraintKind } from '../core/api.ts';
import type { ElementForm } from '../../../packages/core/src/registry.ts';
/** Authoring descriptors; no constraint-child machinery is paid for by a JSON scene. */
export function constraintElements(
  kinds: ReadonlyMap<string, ConstraintKind>,
): Record<string, ElementForm> {
  return Object.fromEntries(
    [...kinds.values()].map((c) => [
      c.kind.replace(/[A-Z]/g, (v) => '-' + v.toLowerCase()),
      {
        shape: {
          k: 'obj',
          p: {
            strength: { k: 'num', min: 0, max: 1 },
            ...Object.fromEntries(
              Object.entries(c.shape.p).map(([key, value]) => [
                key,
                {
                  ...value,
                  markup: value.markup ?? key.replace(/[A-Z]/g, (v) => '-' + v.toLowerCase()),
                },
              ]),
            ),
          },
          req: c.shape.req,
        },
        values: { kind: c.kind },
        target: {
          attribute: 'into',
          default: 'constraints',
          choices: ['constraints'],
          array: true,
        },
      },
    ]),
  );
}

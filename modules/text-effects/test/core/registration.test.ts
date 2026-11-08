import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
it('effects may arrive before the optional text node; later registration composes its fields', () => {
  const result = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import {registerModule,nodeShape} from './packages/core/src/index.ts';
    import {textEffects} from './modules/text-effects/core/index.ts';
    registerModule(textEffects);
    const {text}=await import('./modules/text/core/index.ts');
    registerModule(text);
    console.log(nodeShape('text').p.effects.feature);
  `,
    ],
    { encoding: 'utf8' },
  );
  expect(result.trim()).toBe('texteffects');
});

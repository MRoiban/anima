// Regression tests for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import '../../../../packages/core/src/all.ts';
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';

it('R1-05: a pointer-disabled descendant does not supply its group hit area', () => {
  const r = load({
    anima: '0.1',
    name: 'p4',
    grid: 20,
    requires: ['input'],
    nodes: [
      {
        id: 'g',
        type: 'group',
        children: [
          {
            id: 'c',
            type: 'circle',
            center: [10, 10],
            r: 5,
            fill: { color: '#000' },
            pointerEnabled: false,
          },
        ],
      },
    ],
    inputs: { a: { type: 'bool' } },
    listeners: [{ on: 'click', target: 'g', set: { a: true } }],
  });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!),
    c = p.input();
  expect(c.hitTest(10, 10)).toEqual([]);
  c.pointer('down', 10, 10);
  c.pointer('up', 10, 10);
  p.step(0);
  expect(p.get('a')).toBe(false);
});

it('R1-09: input keeps focus listener names when only focus and input are registered', () => {
  const result = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import {registerModule,load} from './packages/core/src/index.ts';
    import {focus} from './modules/focus/core/index.ts';
    import {input} from './modules/input/core/index.ts';
    registerModule(focus);
    registerModule(input);
    const r = load({anima:'0.1',name:'p4',grid:20,requires:['focus','input'],
      nodes:[{id:'c',type:'circle',center:[10,10],r:4,fill:{color:'#000'},focus:{}}],
      inputs:{a:{type:'bool'}},listeners:[{on:'focus',target:'c',set:{a:true}}]});
    console.log(JSON.stringify(r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.code)));
  `,
    ],
    { encoding: 'utf8' },
  );
  expect(result.trim()).toBe('[]');
});

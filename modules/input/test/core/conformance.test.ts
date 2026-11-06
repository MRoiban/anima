import '../../../../packages/core/src/all.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { inputCommand } from '../../core/commands.ts';
interface Vector {
  document: Record<string, unknown>;
  script: string[];
  expected: { inputs: Record<string, unknown>; events: string[]; states: Record<string, string> }[];
}
const root = new URL('../../conformance/', import.meta.url);
for (const name of readdirSync(root).filter((n) => n.endsWith('.json')))
  it(`input conformance: ${name}`, () => {
    const vector = JSON.parse(readFileSync(new URL(name, root), 'utf8')) as Vector;
    const loaded = load(vector.document);
    expect(loaded.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const p = new Player(loaded.model!);
    const snapshots = [];
    for (const line of vector.script) {
      const [command, ...args] = line.split(' ');
      expect(inputCommand(p, command!, args)).toBe(true);
      const result = p.step(0);
      snapshots.push({
        inputs: Object.fromEntries(
          [...p.model.inputs]
            .filter(([, i]) => i.type !== 'trigger')
            .map(([name]) => [name, p.get(name)]),
        ),
        events: result.events.map((e) => e.name),
        states: p.states(),
      });
    }
    // Hand-authored golden inputs/events, not observations regenerated from the implementation.
    expect(snapshots).toEqual(vector.expected);
  });

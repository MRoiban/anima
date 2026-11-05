import { readFileSync, readdirSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { load } from '../src/index.ts';
import { schemaText } from '../../../tools/gen-schema.ts';

const EX = new URL('../../../examples/', import.meta.url);
const examples = readdirSync(EX).filter((f) => f.endsWith('.ani'));
const schemaFile = new URL('../../../spec/schema/ani.schema.json', import.meta.url);

describe('examples', () => {
  it('the committed schema is the generated one (run `npm run gen`)', () => {
    expect(readFileSync(schemaFile, 'utf8')).toBe(schemaText());
  });

  const validate = new Ajv2020({ strict: true, strictTuples: false, allErrors: true }).compile(
    JSON.parse(readFileSync(schemaFile, 'utf8')),
  );

  it.each(examples)('%s validates against the schema and the loader', (f) => {
    const text = readFileSync(new URL(f, EX), 'utf8');
    expect(validate(JSON.parse(text)), JSON.stringify(validate.errors)).toBe(true);
    const r = load(text);
    expect(r.diagnostics).toEqual([]);
    expect(r.model).toBeDefined();
  });

  it('the schema rejects what the loader rejects structurally', () => {
    const bell = JSON.parse(readFileSync(new URL('bell.ani', EX), 'utf8'));
    bell.nodes[0].rotation = 3;
    expect(validate(bell)).toBe(false);
  });
});

describe('truncation', () => {
  it('every prefix of bell.ani parses or returns diagnostics, never throws', () => {
    const text = readFileSync(new URL('bell.ani', EX), 'utf8');
    for (let i = 0; i < text.length; i++) {
      const r = load(text.slice(0, i));
      expect(r.model === undefined ? r.diagnostics.length > 0 : true).toBe(true);
    }
  });

  it('survives hostile input', () => {
    expect(load('['.repeat(100000)).diagnostics[0]!.code).toBe('json-syntax');
    const deep = { anima: '0.1', name: 'x', grid: 20, nodes: [{}] as unknown[] };
    let cur = deep.nodes;
    for (let i = 0; i < 5000; i++) {
      const g = { id: `g${i}`, type: 'group', children: [] as unknown[] };
      cur.push(g);
      cur = g.children;
    }
    deep.nodes.shift();
    expect(load(deep).diagnostics.some((d) => d.code === 'limit-exceeded')).toBe(true);
    expect(load('x'.repeat(2 << 20)).diagnostics[0]!.code).toBe('limit-exceeded');
    for (const junk of [
      'null',
      '1',
      '"s"',
      '[]',
      '{}',
      '{"anima":"0.1"}',
      '{"anima":"0.1","nodes":{}}',
    ])
      expect(load(junk).diagnostics.length).toBeGreaterThan(0);
  });
});

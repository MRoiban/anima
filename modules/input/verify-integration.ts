// Tooling smoke check for generic registry attributes and sample command delegation.
import assert from 'node:assert/strict';
import { compile, decompile } from '../../packages/markup/src/index.ts';
import { load, runScript } from '../../packages/core/src/index.ts';
const source = `<anima version="0.1" name="input-demo" grid="20" requires="input">
<number name="dragX"/><bool name="key"/><circle id="disc" cx="10" cy="10" r="5" fill="#000"/>
<listener on="drag" target="disc" align="preserve" write='{"dx":"dragX"}'/>
<listener on="key-down" key="k" modifiers="control" set="key=true"/>
</anima>`;
const r = compile(source);
assert.ok(r.doc, JSON.stringify(r.diagnostics));
assert.equal(r.diagnostics.length, 0);
const round = compile(decompile(r.doc));
assert.deepEqual(round.doc, r.doc);
const model = load(r.doc).model!;
const result = runScript(
  model,
  'contact down 7 10 10\ncontact move 7 15 10\nkey down k control\nsnapshot dragX key',
);
assert.deepEqual(result.snapshots[0]!.values, { dragX: 5, key: true });
console.log('input integration: compile/decompile, filters, drag write, sample commands pass');

// Normalize independent native observations only. Never sample Anima to construct expectations.
import '../../packages/core/src/all.ts';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { format } from 'prettier';
import { compile, formatMarkup } from '../../packages/markup/src/index.ts';
interface Native {
  nested: { artboard: string; viewModels?: { properties: { name: string; value: number }[] }[] }[];
}
const capture = (probe: string, frame: string) =>
  JSON.parse(readFileSync(`modules/nested/oracle/${probe}/frames/${frame}.json`, 'utf8')) as Native;
const value = (probe: string, frame: string, key: string) =>
  capture(probe, frame).nested[0]!.viewModels![0]!.properties.find((p) => p.name === key)!.value;
const read = (p: string) => readFileSync(p, 'utf8');
const conformance = (name: string) => read('spec/conformance/' + name + '/case.animl');
const observation = (values: Record<string, number | string>, click: number) => ({
  click,
  values,
  events: [],
});
const cases = [
  {
    name: 'components-nested-remap',
    source: conformance('components-nested-remap'),
    script:
      'advance 0\nsnapshot badge/dot.x\nset $t 0.25\nadvance 0\nsnapshot badge/dot.x\nset $t 0.75\nadvance 0\nsnapshot badge/dot.x\nset $t 0.25\nadvance 0\nsnapshot badge/dot.x\n',
    observations: ['initial', 'quarter', 'three-quarter', 'back'].map((f, i) =>
      observation({ 'badge/dot.x': value('remap', f, 'x') }, i),
    ),
  },
  {
    name: 'components-leaf-fit',
    source: conformance('components-leaf-fit'),
    script: read('spec/conformance/components-leaf-fit/script.txt'),
    observations: ['initial', 'clicked'].map((f, i) =>
      observation({ 'badge/dot.r': 2 - value('fit', f, 'clicked') }, i),
    ),
  },
  {
    name: 'components-stateful-output',
    source:
      '<anima version="0.1" name="components-stateful-output" grid="20" requires="components nested bind"><component name="row" grid="10"><number name="count" default="6"/><circle id="dot" cx="5" cy="5" r="1" fill="#000"/><output name="done" value="count"/></component><instance id="badge" component="row"/></anima>',
    script: 'advance 0\nsnapshot badge/outputs.done\n',
    observations: [observation({ 'badge/outputs.done': value('output', 'initial', 'done') }, 0)],
  },
  {
    name: 'data-property-artboard',
    source: conformance('data-property-artboard').replace('default="row"', 'default="box"'),
    script: 'advance 0\nsnapshot $card\n',
    observations: [observation({ $card: capture('property', 'initial').nested[0]!.artboard }, 0)],
  },
  {
    name: 'components-nested-quantize-nonboundary',
    source: conformance('components-nested-quantize'),
    script: 'advance 0.12\nsnapshot badge/dot.x\nadvance 0.14\nsnapshot badge/dot.x\n',
    observations: ['first', 'second'].map((f, i) =>
      observation({ 'badge/dot.x': value('quantize-nonboundary', f, 'x') }, i),
    ),
  },
  {
    name: 'components-nested-quantize',
    source: conformance('components-nested-quantize'),
    script: read('spec/conformance/components-nested-quantize/script.txt'),
    observations: ['first', 'second'].map((f, i) =>
      observation({ 'badge/dot.x': value('quantize', f, 'x') }, i),
    ),
    finding: true,
  },
];
const manifestPath = 'tests/oracle/cases.json';
let manifestSource = read(manifestPath);
const manifest = JSON.parse(manifestSource) as { name: string }[];
for (const c of cases) {
  const dir = 'tests/oracle/' + c.name;
  mkdirSync(dir + '/rive', { recursive: true });
  const source = formatMarkup(c.source).text!;
  const compiled = compile(source);
  if (compiled.diagnostics.length || !compiled.text)
    throw Error(JSON.stringify(compiled.diagnostics));
  writeFileSync(dir + '/case.animl', source);
  writeFileSync(dir + '/case.ani', compiled.text);
  writeFileSync(dir + '/script.txt', c.script);
  writeFileSync(dir + '/rive/observations.json', JSON.stringify(c.observations, null, 2) + '\n');
  writeFileSync(
    dir + '/rive/README.md',
    'Native sources, commands, raw JSON and session logs: modules/nested/oracle/.\nNormalizer: modules/nested/build-oracle.ts. No Anima sampling generates these references.\nRemap uses positive 1 µs flush steps because zero-delta native bindings retain their previous sample.\nFit maps clicked 0/1 to radius 2-clicked; the click is (15,5), beyond source width 10.\nComponent selection reads the actual nested artboard name; native property text is empty and host writes are rejected, retained in session.txt.\n',
  );
  rmSync(dir + '/todo.json', { force: true });
  const entry = {
    name: c.name,
    times: [0],
    threshold: 0,
    maxDiff: 0,
    maxOverPercent: 0,
    observations: { script: 'script.txt', reference: 'rive/observations.json' },
  };
  if (c.finding)
    writeFileSync(
      dir + '/finding.json',
      await format(
        JSON.stringify(
          {
            status: 'finding',
            reason:
              'Native exact-boundary nested quantization at 0.12s + 0.13s gives x1→2; Anima gives x1→3 (delta 1). At nonboundary 0.12s + 0.14s both give x1→3. This supports a precision-boundary explanation rather than per-step truncation; that explanation is an inference. Limits and original observations are unchanged.',
            case: entry,
            // Collection metrics use time=0; actual values are independently calculated from x=12*floor(t*12)/12.
            observations: [
              {
                time: 0,
                sampleTime: 0.25,
                actual: [
                  observation({ 'badge/dot.x': 1 }, 0),
                  observation({ 'badge/dot.x': 3 }, 1),
                ],
                reference: c.observations,
                delta: 1,
              },
            ],
          },
          null,
          2,
        ),
        { parser: 'json', printWidth: 100 },
      ),
    );
  else if (!manifest.some((m) => m.name === c.name)) {
    const addition = (await format(JSON.stringify(entry), { parser: 'json', printWidth: 100 }))
      .trim()
      .split('\n')
      .map((line) => '  ' + line)
      .join('\n');
    manifestSource = manifestSource.trimEnd().replace(/\n]$/, ',\n' + addition + '\n]') + '\n';
    manifest.push(entry);
  }
}
writeFileSync(manifestPath, manifestSource);

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatAni, load, NODE_TYPES } from '@anima-format/core';
import { compile, parseXml, type Element, type Pos } from '../src/index.ts';
import { nodeAttrs } from '../src/names.ts';

const bell = readFileSync(new URL('../../../examples/bell.animl', import.meta.url), 'utf8');
const ani = readFileSync(new URL('../../../examples/bell.ani', import.meta.url), 'utf8');

// Independent, handwritten input and expected document: all 23 §4 element names and every
// attribute, including both path sources and both hit shapes (the latter in a second document).
const all = `<anima xmlns="urn:anima" version="0.1" name="complete" title="All forms" grid="20" viewBox="-2,-2 24, 24" requires="knockout">
  <!-- Document comment -->
  <meta>{"author":"agent","nested":{"tags":[true,2,null]}}</meta>
  <color name="ink" value="currentColor"/>
  <glyph name="line" d="M0 0L10 0" source="hand" pick="line-1" sha256="cc01ab40b590a0642ebf6778cfec4c14e51d6a62edd6008431532960424d4d06"/>
  <a11y role="switch" label="Toggle" activate="tap" pressed="active" held="down"/>
  <bool name="active" default="true"/>
  <bool name="down" default="false"/>
  <number name="level" default="0.5" min="0" max="1"/>
  <trigger name="tap" buffer="0.2"/>
  <hit circle="10 10 11"/>
  <group id="icon" pivot="10,10" x="1" y="2" rotate="3" scale="1" scaleX="1.1" scaleY="0.9" opacity="0.8" visible="true">
    <path id="line" glyph="line" subpaths="0" stroke="ink" stroke-width="1" stroke-linecap="square" stroke-linejoin="bevel" trimStart="0" trimEnd="0.9" trimOffset="0.1" knockout="0"/>
    <path id="inline" d="M0 0L1 0L1 1Z" fill="#abcdef88" fill-rule="evenodd"/>
    <circle id="dot" cx="4" cy="5" r="2" fill="#123456"/>
    <rect id="bar" x0="0" y0="1" width="2" height="3" rx="0.5" fill="ink"/>
    <arc id="wave" cx="10" cy="10" r="8" from="-90" to="90" stroke="#abc"/>
  </group>
  <ease name="sway" curve="cubic(0.45,0,0.55,1)"/>
  <timeline name="motion" duration="1" loop="once" reducedMotion="play">
    <!-- Timeline comment -->
    <track target="bar.width">0 2 sway; 1 4</track>
    <track target="dot.visible">0 true hold; 1 false</track>
    <track target="dot.fill">0 #123456; 1 #abcdef</track>
    <track target="wave.stroke-width">0 1 elastic(1,0.45); 1 2</track>
    <track target="line.trimEnd">0 0; 1 1</track>
    <event at="0.5" name="middle"/>
  </timeline>
  <layer name="main" initial="idle">
    <state name="idle" emit="entered">
      <pose bar.width="3" dot.fill="#abcdef" wave.stroke-width="2" line.trimEnd="0.5" dot.visible="false"/>
      <on when="tap and ! down and level>=0.5" to="playing" blend="0.1" ease="sway" interruptible="false"/>
    </state>
    <state name="playing" play="motion" speed="2" emit="playing">
      <on when="@end" to="idle"/>
    </state>
  </layer>
  <listener on="click" target="dot" hitPadding="1" fire="tap" set="active=false level=0.75" toggle="active down" emit="clicked"/>
</anima>`;

const expected = {
  $comment: 'Document comment',
  anima: '0.1',
  name: 'complete',
  title: 'All forms',
  grid: 20,
  viewBox: [-2, -2, 24, 24],
  requires: ['knockout'],
  meta: { author: 'agent', nested: { tags: [true, 2, null] } },
  colors: { ink: 'currentColor' },
  glyphs: {
    line: {
      source: 'hand',
      pick: 'line-1',
      sha256: 'cc01ab40b590a0642ebf6778cfec4c14e51d6a62edd6008431532960424d4d06',
      d: 'M0 0L10 0',
    },
  },
  a11y: { role: 'switch', label: 'Toggle', activate: 'tap', pressed: 'active', held: 'down' },
  inputs: {
    active: { type: 'bool', default: true },
    down: { type: 'bool', default: false },
    level: { type: 'number', default: 0.5, min: 0, max: 1 },
    tap: { type: 'trigger', buffer: 0.2 },
  },
  hit: { circle: [10, 10, 11] },
  nodes: [
    {
      id: 'icon',
      type: 'group',
      pivot: [10, 10],
      x: 1,
      y: 2,
      rotate: 3,
      scale: 1,
      scaleX: 1.1,
      scaleY: 0.9,
      opacity: 0.8,
      visible: true,
      children: [
        {
          id: 'line',
          type: 'path',
          glyph: 'line',
          subpaths: [0],
          stroke: {
            color: 'ink',
            width: 1,
            cap: 'square',
            join: 'bevel',
            trimStart: 0,
            trimEnd: 0.9,
            trimOffset: 0.1,
          },
          knockout: 0,
        },
        {
          id: 'inline',
          type: 'path',
          d: 'M0 0L1 0L1 1Z',
          fill: { color: '#abcdef88', rule: 'evenodd' },
        },
        { id: 'dot', type: 'circle', center: [4, 5], r: 2, fill: { color: '#123456' } },
        { id: 'bar', type: 'rect', x0: 0, y0: 1, w: 2, h: 3, rx: 0.5, fill: { color: 'ink' } },
        {
          id: 'wave',
          type: 'arc',
          center: [10, 10],
          r: 8,
          from: -90,
          to: 90,
          stroke: { color: '#abc' },
        },
      ],
    },
  ],
  timelines: {
    motion: {
      $comment: 'Timeline comment',
      duration: 1,
      loop: 'once',
      reducedMotion: 'play',
      tracks: {
        'bar.w': [
          [0, 2, 'cubic(0.45, 0, 0.55, 1)'],
          [1, 4],
        ],
        'dot.visible': [
          [0, true, 'hold'],
          [1, false],
        ],
        'dot.fill.color': [
          [0, '#123456'],
          [1, '#abcdef'],
        ],
        'wave.stroke.width': [
          [0, 1, 'elastic(1, 0.45)'],
          [1, 2],
        ],
        'line.stroke.trimEnd': [
          [0, 0],
          [1, 1],
        ],
      },
      events: [[0.5, 'middle']],
    },
  },
  machine: {
    layers: {
      main: {
        initial: 'idle',
        states: {
          idle: {
            pose: {
              'bar.w': 3,
              'dot.fill.color': '#abcdef',
              'wave.stroke.width': 2,
              'line.stroke.trimEnd': 0.5,
              'dot.visible': false,
            },
            emit: 'entered',
            on: [
              {
                when: 'tap && !down && level >= 0.5',
                to: 'playing',
                blend: 0.1,
                ease: 'cubic(0.45, 0, 0.55, 1)',
                interruptible: false,
              },
            ],
          },
          playing: {
            play: 'motion',
            speed: 2,
            emit: 'playing',
            on: [{ when: '@end', to: 'idle' }],
          },
        },
      },
    },
  },
  listeners: [
    {
      on: 'click',
      target: 'dot',
      hitPadding: 1,
      fire: 'tap',
      set: { active: false, level: 0.75 },
      toggle: ['active', 'down'],
      emit: 'clicked',
    },
  ],
};
const wrap = (body: string) =>
  `<anima version="0.1" name="test" grid="20">\n<circle id="dot" cx="0" cy="0" r="1" fill="#123"/>\n${body}\n</anima>`;
const pos = (source: string, needle: string, skip = 0): Pos => {
  const offset = source.indexOf(needle) + skip;
  const lines = source.slice(0, offset).split('\n');
  return { offset, line: lines.length, col: lines.at(-1)!.length + 1 };
};

function pointers(value: unknown, p = ''): string[] {
  return [
    p,
    ...(value !== null && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, child]) =>
          pointers(child, p + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1')),
        )
      : []),
  ];
}

describe('AniML compiler', () => {
  it('builds bell byte for byte, without diagnostics', () => {
    const result = compile(bell, {
      file: 'examples/bell.animl',
      resolve: (path) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8'),
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(ani);
    expect(result.doc).toEqual(JSON.parse(ani));
    expect(Object.keys(result.doc!)).toEqual(Object.keys(JSON.parse(ani)));
  });

  it('compiles every §4 element and attribute to independently written .ani', () => {
    const result = compile(all);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.doc).toEqual(expected);
    expect(result.text).toBe(formatAni(expected));
    expect(load(expected).model).toBeDefined();
    const rect = compile(all.replace('circle="10 10 11"', 'rect="0 0 20 20"'));
    expect(rect.doc?.hit).toEqual({ circle: undefined, rect: [0, 0, 20, 20] });
  });

  it('keeps the fixture coverage honest (23 element names; all node attribute spellings)', () => {
    const elements: Element[] = [];
    const walk = (el: Element) => {
      elements.push(el);
      for (const c of el.children) if (c.kind === 'element') walk(c);
    };
    walk(parseXml(all).doc.root!);
    expect(new Set(elements.map((e) => e.name))).toEqual(
      new Set([
        'anima',
        'meta',
        'color',
        'glyph',
        'a11y',
        'bool',
        'number',
        'trigger',
        'hit',
        ...NODE_TYPES.filter((t) => ['group', 'path', 'circle', 'rect', 'arc'].includes(t)),
        'ease',
        'timeline',
        'track',
        'event',
        'layer',
        'state',
        'pose',
        'on',
        'listener',
      ]),
    );
    const paintElements: Element[] = [];
    const collectPaint = (el: Element) => {
      paintElements.push(el);
      for (const c of el.children) if (c.kind === 'element') collectPaint(c);
    };
    collectPaint(
      parseXml(readFileSync(new URL('../../../examples/paint.animl', import.meta.url), 'utf8')).doc
        .root!,
    );
    collectPaint(
      parseXml(readFileSync(new URL('../../../examples/shapes.animl', import.meta.url), 'utf8')).doc
        .root!,
    );
    collectPaint(
      parseXml(readFileSync(new URL('../../../examples/composite.animl', import.meta.url), 'utf8'))
        .doc.root!,
    );
    collectPaint(
      parseXml(readFileSync(new URL('../../../examples/photo.animl', import.meta.url), 'utf8')).doc
        .root!,
    );
    for (const name of ['slice', 'feather'])
      collectPaint(
        parseXml(readFileSync(new URL(`../../../examples/${name}.animl`, import.meta.url), 'utf8'))
          .doc.root!,
      );
    collectPaint(
      parseXml(
        readFileSync(
          new URL('../../../spec/draw-conformance/surface-image/case.animl', import.meta.url),
          'utf8',
        ),
      ).doc.root!,
    );
    collectPaint(
      parseXml(
        '<anima><repeat id="rows" list="$items" count="$n" component="row" dx="2" dy="3" size="10 5"/></anima>',
      ).doc.root!,
    );
    for (const form of ['slice', 'feather', 'imagePaint'])
      expect(paintElements.some((e) => e.name === form)).toBe(true);
    collectPaint(
      parseXml(
        '<anima><instance id="i" component="badge" speed="2" paused="true" data="main" time="$t" fps="12" fit="contain" align="right" size="20 10"/></anima>',
      ).doc.root!,
    );
    collectPaint(
      parseXml(readFileSync(new URL('../../../examples/motion.animl', import.meta.url), 'utf8')).doc
        .root!,
    );
    collectPaint(
      parseXml(
        '<anima><group id="g" opaque="true" cursor="pointer" pointerEnabled="false" collapsed="true" solo="0" properties="{}"/></anima>',
      ).doc.root!,
    );
    for (const file of [
      'drawing-paint-straight-vertex',
      'drawing-paint-geometry-origin',
      'drawing-paint-trim-sequential',
      'drawing-paint-effect-order',
      'drawing-paint-paint-blend-override',
      'drawing-paint-fill-rule-clockwise',
    ])
      collectPaint(
        parseXml(
          readFileSync(
            new URL('../../../spec/conformance/' + file + '/case.animl', import.meta.url),
            'utf8',
          ),
        ).doc.root!,
      );
    collectPaint(
      parseXml(
        '<anima><image wrap="repeat" wrap-x="mirror" wrap-y="clamp"/><rect mix="{&quot;mode&quot;:&quot;normal&quot;}" fill-blend-amount="0.5" stroke-blend-amount="0.5"/></anima>',
      ).doc.root!,
    );
    collectPaint(
      parseXml(
        // seam(P6-5): new node attribute spellings remain in the exhaustive coverage check.
        '<anima><text background="{}" text-effects="[]" direction="ltr" runs="$items" styles="{}" sizing="fixed" width="4" height="4" align="left" valign="top" overflow="visible" wrap="true" word-break="normal" origin="baseline" line-height="1" paragraph-spacing="0" vertical-trim-top="cap" vertical-trim-bottom="baseline" fit-from-baseline="false" fit-font-size-resizes-box="false" text-field="label" style-field="style"/></anima>',
      ).doc.root!,
    );
    // seam(P7-4): include reflow in the layout spelling census.
    // seam(P7-2): cover every layout container/participant spelling in the independent fixture census.
    collectPaint(
      parseXml(
        '<anima><layout reflow="0.25 out" direction="row" justify="space-between" align="stretch" gap="1" padding="1" min-width="0" max-width="20" min-height="0" max-height="20" corners="1"><rect layout-width="fill" layout-height="fill" align-self="end" margin="1" display="none"/></layout></anima>',
      ).doc.root!,
    );
    // seam(P8-6): include all posepad attribute spellings in the registry census.
    collectPaint(
      parseXml(
        '<anima><posepad timeline-x="x" timeline-y="y" value-x="0" value-y="0" invert-x="true" invert-y="true" handle="knob" box="0 0 2 2"/></anima>',
      ).doc.root!,
    );
    const attrs = new Set(
      [...elements, ...paintElements].flatMap((e) => e.attrs.map((a) => a.name)),
    );
    for (const type of NODE_TYPES)
      for (const a of nodeAttrs(type)) expect(attrs.has(a.attr), a.attr).toBe(true);
  });

  it('maps every produced JSON pointer, including containers, comments and vector entries', () => {
    for (const source of [bell, all]) {
      const result = compile(source, {
        file: 'examples/bell.animl',
        resolve: (path) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8'),
      });
      for (const p of pointers(result.doc)) expect(result.map.has(p), p).toBe(true);
    }
    const result = compile(all);
    const checks = {
      '/grid': pos(all, 'grid="20"', 6),
      '/nodes/0': pos(all, '<group'),
      '/nodes/0/type': pos(all, '<group'),
      '/nodes/0/pivot/1': pos(all, 'pivot="10,10"', 7),
      '/nodes/0/children/2/center/1': pos(all, 'cy="5"', 4),
      '/nodes/0/children/0/stroke/width': pos(all, 'stroke-width="1"', 14),
      '/timelines/motion/$comment': pos(all, '<!-- Timeline'),
      '/timelines/motion/tracks/bar.w': pos(all, 'target="bar.width"', 8),
      '/timelines/motion/tracks/bar.w/0/0': pos(all, '>0 2 sway', 1),
      '/timelines/motion/tracks/bar.w/0/1': pos(all, '>0 2 sway', 3),
      '/timelines/motion/tracks/bar.w/0/2': pos(all, '>0 2 sway', 5),
      '/timelines/motion/events/0/0': pos(all, 'at="0.5"', 4),
      '/machine/layers/main/states/idle/pose/bar.w': pos(all, 'bar.width="3"', 11),
    };
    for (const [p, at] of Object.entries(checks)) expect(result.map.get(p), p).toEqual(at);
  });

  it('maps keyframe tokens using raw text offsets even after entities and comments', () => {
    const source = wrap(
      '<timeline name="t" duration="1"><track target="dot.scale">&#48; 1 hold; 0.5 <!-- ignore --> 2;\n1 3</track></timeline>',
    );
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    const p = '/timelines/t/tracks/dot.scale';
    expect(result.map.get(p + '/0/0')).toEqual(pos(source, '&#48;'));
    expect(result.map.get(p + '/0/1')).toEqual(pos(source, '&#48; 1', 6));
    expect(result.map.get(p + '/1/1')).toEqual(pos(source, '--> 2', 4));
    expect(result.map.get(p + '/2/0')).toEqual(pos(source, '\n1 3', 1));
  });

  it.each([
    [
      'unknown-state',
      '<layer name="main" initial="idle">\n<state name="idle"><on when="@after(1)" to="idel"/></state>\n</layer>',
      'to="idel"',
      4,
    ],
    [
      'unknown-address',
      '<timeline name="t" duration="1">\n<track target="dot.rotaet">0 0; 1 1</track>\n</timeline>',
      'target="dot.rotaet"',
      8,
    ],
    [
      'bad-ease',
      '<timeline name="t" duration="1"><track target="dot.scale">\n0 1 cubic-bezier(0, 0, 1, 1)\n1 2\n</track></timeline>',
      'cubic-bezier(',
      0,
    ],
    [
      'key-range',
      '<timeline name="t" duration="1"><track target="dot.scale">\n0 1\n60 2\n</track></timeline>',
      '60 2',
      0,
    ],
  ])('maps loader %s to the original value/token', (code, body, needle, skip) => {
    const source = wrap(body);
    const result = compile(source, { file: 'broken.animl' });
    const at = pos(source, needle, skip);
    expect(result.diagnostics.find((d) => d.code === code)).toMatchObject({
      code,
      severity: 'error',
      file: 'broken.animl',
      line: at.line,
      column: at.col,
    });
    expect(result.doc).toBeUndefined();
    expect(result.text).toBeUndefined();
    if (code === 'unknown-state')
      expect(result.diagnostics.find((d) => d.code === code)?.hint).toContain('idle');
  });

  it('uses longest mapped pointer prefix for loader diagnostics on derived/missing values', () => {
    const source = wrap('<listener on="click"/>');
    const result = compile(source);
    const at = pos(source, '<listener');
    expect(result.diagnostics.find((d) => d.code === 'missing-key')).toMatchObject({
      pointer: '/listeners/0',
      line: at.line,
      column: at.col,
    });
  });

  it('can skip loader validation while still checking markup', () => {
    const source = wrap(
      '<timeline name="t" duration="1"><track target="ghost.scale">0 1</track></timeline>',
    );
    expect(compile(source).text).toBeUndefined();
    expect(compile(source, { validate: false }).doc).toBeDefined();
    expect(compile(wrap('<circle id="other"/>'), { validate: false }).text).toBeUndefined();
  });

  it('keeps warnings and successful output together, with file and positions', () => {
    const source = wrap('<bool name="unused"/>');
    const result = compile(source, { file: 'warnings.animl' });
    expect(result.text).toBeDefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unused-input',
        severity: 'warning',
        file: 'warnings.animl',
        line: 3,
      }),
    );
  });

  it('resolves forward named ease references and canonicalises arguments', () => {
    const source = wrap(
      '<timeline name="t" duration="1"><track target="dot.scale">0 1 alias; 1 2</track></timeline><ease name="alias" curve="curve"/><ease name="curve" curve="cubic(4.5e-1,0,0.55,1)"/>',
    );
    expect(compile(source).diagnostics).toEqual([]);
    expect(compile(source).text).toContain('cubic(0.45, 0, 0.55, 1)');
    expect(
      compile(wrap('<ease name="a" curve="b"/><ease name="b" curve="a"/>')).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: 'bad-attribute' }));
  });

  it('keeps map declaration and scene paint order, independent of child-kind order', () => {
    const result = compile(
      wrap(
        '<layer name="z" initial="s"><state name="s"/></layer><color name="second" value="#123"/><layer name="a" initial="s"><state name="s"/></layer><color name="first" value="#fff"/>',
      ),
    );
    expect(result.diagnostics).toEqual([]);
    const machine = result.doc!.machine as { layers: Record<string, unknown> };
    expect(Object.keys(machine.layers)).toEqual(['z', 'a']);
    expect(Object.keys(result.doc!.colors as object)).toEqual(['second', 'first']);
    expect(machine.layers.z).toEqual({ initial: 's', states: { s: { pose: {} } } });
  });

  it('preserves only the first comment before an object’s first child', () => {
    const result = compile(
      wrap(
        '<layer name="main" initial="s"><!-- first --><!-- drop --><state name="s"><!-- pose state --></state><!-- late --></layer>',
      ),
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('"$comment": "first"');
    expect(result.text).toContain('"$comment": "pose state"');
    expect(result.text).not.toContain('drop');
    expect(result.text).not.toContain('late');
  });

  it.each([
    '<layer name="m" initial="s" mode="additive"><state name="s"/></layer>',
    '<timeline name="t" duration="1"><track target="dot.d">0 1; 1 2</track></timeline>',
    '<timeline name="t" duration="1"><track target="dot.scale">0 1 spring(1); 1 2</track></timeline>',
    '<timeline name="t" duration="1" colorSpace="linear"/>',
  ])('rejects the 0.2 form with reserved: %s', (body) => {
    expect(compile(wrap(body)).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'reserved', severity: 'error', line: 3 }),
    );
  });

  it.each(['01', '+1', '.5', '1.', 'NaN', 'Infinity', '1e999'])(
    'rejects non-JSON/non-finite numeric attribute %s',
    (number) => {
      expect(
        compile(wrap(`<listener on="click" hitPadding="${number}" emit="event"/>`)).diagnostics,
      ).toContainEqual(expect.objectContaining({ code: 'bad-attribute' }));
    },
  );

  it.each(['0,,1', '0,1,', '0 1 2', '0 .5'])('rejects malformed vector %s', (pivot) => {
    expect(compile(wrap(`<group id="g" pivot="${pivot}"/>`)).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'bad-attribute' }),
    );
  });

  it.each([
    '<state name="s"><on when="@after(1)" to="s"/><pose/></state>',
    '<state name="s"><pose/><pose/></state>',
  ])('checks pose multiplicity/order: %s', (state) => {
    expect(
      compile(wrap(`<layer name="m" initial="s">${state}</layer>`)).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: 'misplaced-element' }));
  });

  it('checks duplicate map declarations, including tracks after address translation', () => {
    for (const body of [
      '<bool name="x"/><trigger name="x"/>',
      '<ease name="linear" curve="hold"/>',
      '<layer name="m" initial="s"><state name="s"/><state name="s"/></layer>',
      '<timeline name="t" duration="1"><track target="dot.fill">0 #123</track><track target="dot.fill.color">0 #123</track></timeline>',
    ])
      expect(compile(wrap(body)).diagnostics).toContainEqual(
        expect.objectContaining({ code: 'duplicate-name' }),
      );
  });

  it('uses unknown element/attribute suggestions', () => {
    expect(
      compile(wrap('<circl/>')).diagnostics.find((d) => d.code === 'unknown-element')?.hint,
    ).toContain('circle');
    expect(
      compile(wrap('<group id="g" roatte="1"/>')).diagnostics.find(
        (d) => d.code === 'unknown-attribute',
      )?.hint,
    ).toContain('rotate');
  });

  it('omits a valid final ease after validating it, and does not hide an invalid final ease', () => {
    const source = wrap(
      '<timeline name="t" duration="1"><track target="dot.scale">0 1 linear</track></timeline>',
    );
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('[0, 1]');
    expect(result.map.has('/timelines/t/tracks/dot.scale/0/2')).toBe(false);
    for (const [ease, code] of [
      ['spring(1)', 'reserved'],
      ['cubic-bezier(0, 0, 1, 1)', 'bad-ease'],
    ]) {
      expect(compile(source.replace('1 linear', `1 ${ease}`)).diagnostics).toContainEqual(
        expect.objectContaining({ code }),
      );
    }
  });

  it('parses a paint slot named true as a colour string, and trims colour whitespace', () => {
    const source = wrap(
      '<color name="true" value=" #abc "/><path id="p" d="M0 0L1 1" stroke=" true "/>',
    );
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.doc?.colors).toEqual({ true: '#abc' });
    expect(result.doc?.nodes).toContainEqual({
      id: 'p',
      type: 'path',
      d: 'M0 0L1 1',
      stroke: { color: 'true' },
    });
  });

  it('uses trimmed names consistently in declarations and address translation', () => {
    const source = wrap(
      '<rect id=" bar " x0="0" y0="0" width="1" height="1" fill="#123"/><timeline name=" t " duration="1"><track target=" bar.width ">0 1 alias; 1 2</track></timeline><ease name=" alias " curve="in"/><layer name=" m " initial=" s "><state name=" s "/></layer>',
    );
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.doc?.timelines).toEqual({
      t: {
        duration: 1,
        tracks: {
          'bar.w': [
            [0, 1, 'in'],
            [1, 2],
          ],
        },
      },
    });
  });

  it('maps address errors in pose attributes and easing errors on transitions', () => {
    const source = wrap(
      '<layer name="m" initial="s"><state name="s">\n<pose dot.typo="1"/>\n<on when="@after(1)" to="s" ease="cubic-bezier(0, 0, 1, 1)"/>\n</state></layer>',
    );
    const result = compile(source);
    for (const [code, needle, skip] of [
      ['unknown-address', 'dot.typo="1"', 10],
      ['bad-ease', 'ease="cubic-bezier', 6],
    ] as const) {
      const at = pos(source, needle, skip);
      expect(result.diagnostics.find((d) => d.code === code)).toMatchObject({
        line: at.line,
        column: at.col,
      });
    }
  });

  it('keeps JSON pointer escaping reversible for unknown addresses', () => {
    const source = wrap(
      '<timeline name="t" duration="1"><track target="ghost.a/b~c">0 1</track></timeline>',
    );
    const result = compile(source);
    expect(result.map.get('/timelines/t/tracks/ghost.a~1b~0c')).toEqual(
      pos(source, 'target="ghost', 8),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unknown-address',
        pointer: '/timelines/t/tracks/ghost.a~1b~0c',
      }),
    );
  });

  it.each([
    '<group id="g">unexpected text</group>',
    '<meta>[]</meta>',
    '<hit/>',
    '<hit circle="0 0 1" rect="0 0 1 1"/>',
    '<listener on="click" set="x=1 x=2"/>',
    '<listener on="click" toggle="x,y"/>',
  ])('rejects malformed text, metadata, hit shapes and lists: %s', (body) => {
    expect(compile(wrap(body)).text).toBeUndefined();
    expect(compile(wrap(body)).diagnostics.some((d) => d.severity === 'error')).toBe(true);
  });

  it('canonicalises multi-line ease attributes', () => {
    const source = wrap(
      '<timeline name="t" duration="1"><track target="dot.scale">0 1 sway; 1 2</track></timeline><ease name="sway" curve="cubic(0.45,\n0,\n0.55,1)"/>',
    );
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('cubic(0.45, 0, 0.55, 1)');
  });

  it('requires whitespace-separated subpath indices', () => {
    expect(compile(wrap('<path id="p" glyph="g" subpaths="0,1"/>')).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'bad-attribute' }),
    );
  });

  it('never throws on every prefix of bell.animl', () => {
    for (let i = 0; i <= bell.length; i++) {
      const result = compile(bell.slice(0, i));
      expect(result).toHaveProperty('diagnostics');
      expect(result.diagnostics.length > 0 || result.text !== undefined, `prefix ${i}`).toBe(true);
    }
  });

  it.each(['<anima name="&#x110000;"/>', '<anima name="&#9999999;"/>', '<anima>'.repeat(300)])(
    'never throws on parser contract edge case %s',
    (source) => {
      expect(compile(source).diagnostics.some((d) => d.code === 'markup-syntax')).toBe(true);
    },
  );
});

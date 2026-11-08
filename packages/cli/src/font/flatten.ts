import { drawFrame, load, Player } from '@anima-format/core';
import { nodeShape } from '../../../core/src/registry.ts';
import { sceneTree, svgAttrs, staticSlots, type El } from '../../../core/src/svg.ts';
import { importSVG } from '../import-svg.ts';
import type { ToolMeasurer } from './measure.ts';
import { outlineSVG } from './svg.ts';

type ObjectValue = Record<string, unknown>;
const xml = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

/** Freeze default text into geometry, retaining document/definition scopes and live group props. */
export function flattenText(
  doc: ObjectValue,
  measurer: ToolMeasurer,
  nodeId?: string,
): ObjectValue {
  const out = structuredClone(doc);
  let found = false,
    clipped = false,
    serial = 0;
  const ids = new Set<string>();
  const collect = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') {
      if ('id' in value && typeof value.id === 'string') ids.add(value.id);
      Object.values(value).forEach(collect);
    }
  };
  collect(out);
  const fresh = () => {
    let id: string;
    do {
      id = 'outline' + serial++;
    } while (ids.has(id));
    ids.add(id);
    return id;
  };
  const fail = (message: string): never => {
    throw Object.assign(new Error(message), {
      code: 'font-flatten',
      pointer: '',
      hint: 'remove editable fields and text-only references, or simplify the unsupported drawing feature',
    });
  };
  const groupKeys = Object.keys(nodeShape('group').p).filter(
    (k) => !['id', 'type', 'children'].includes(k),
  );
  const convert = (definition: ObjectValue, source: ObjectValue, prefix: string) => {
    let player: Player | undefined;
    const getPlayer = () => {
      if (player) return player;
      const result = load(source);
      if (!result.model)
        fail('cannot flatten text: ' + result.diagnostics.map((d) => d.message).join('; '));
      player = new Player(result.model!);
      player.step(0);
      return player;
    };
    const visit = (nodes: unknown, inLayout = false) => {
      if (!Array.isArray(nodes)) return;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i] as ObjectValue;
        if (node.type !== 'text' || (nodeId && nodeId !== prefix + node.id)) {
          visit(node.children, node.type === 'layout');
          continue;
        }
        if (node.textInput) fail('cannot flatten an editable field; remove textInput first');
        // A group has no intrinsic size: its layout footprint and baseline would be lost.
        if (inLayout) fail('cannot flatten a layout participant; its measured size would be lost');
        found = true;
        const p = getPlayer(),
          index = p.model.ids.get(String(node.id))!,
          frame = drawFrame(p);
        // Serialize just the text drawing through every installed SVG backend, including effects
        // and font options. Keep the original node wrapper and its external clip/mask references.
        const find = (els: El[]): El | undefined => {
          for (const el of els) {
            if (el.node === index && el.role === 'module:text') return el;
            const child = find(el.kids);
            if (child) return child;
          }
        };
        const root = find(sceneTree(p.model).root);
        if (!root) fail('text SVG backend is not installed');
        const serialize = (el: El): string => {
          const a = svgAttrs(frame, el, staticSlots(), 'flatten');
          // The text backend owns a rectangular local clip. Preserve it as authored geometry
          // below, avoiding importSVG's deliberate rejection of general SVG clipping.
          if (el.role === 'module:text-clip') return '';
          if (el.role === 'module:text-content') delete a['clip-path'];
          if (a['color-interpolation'] === 'sRGB') delete a['color-interpolation'];
          if (el.tag === 'g' && a.style === 'white-space:pre') delete a.style;
          if (el.tag === 'g') delete a['text-rendering'];
          const attrs = Object.entries(a)
            .filter(([, v]) => v !== null)
            .map(([k, v]) => ` ${k}="${xml(v!)}"`)
            .join('');
          const rendered = `<${el.tag}${attrs}>${el.text === undefined ? el.kids.map(serialize).join('') : xml(el.text)}</${el.tag}>`;
          return ['linearGradient', 'radialGradient'].includes(el.tag)
            ? `<defs>${rendered}</defs>`
            : rendered;
        };
        const svg = `<svg viewBox="${p.model.viewBox.join(' ')}">${serialize(root!)}</svg>`,
          imported = importSVG(outlineSVG(svg, measurer), 'flattened');
        if (imported.diagnostics.length)
          fail(
            'outline conversion cannot preserve SVG feature: ' + imported.diagnostics[0]!.message,
          );
        let children = imported.doc.nodes as ObjectValue[];
        const rename = (nodes: ObjectValue[]) =>
          nodes.forEach((n) => {
            n.id = fresh();
            if (Array.isArray(n.children)) rename(n.children as ObjectValue[]);
          });
        rename(children);
        const clip = (frame.nodes[index] as { text?: { layout: { clip?: number[] } } }).text?.layout
          .clip;
        if (clip) {
          const [x0, y0, w, h] = clip;
          const id = fresh();
          children = [
            { type: 'rect', id, x0, y0, w, h, fill: { color: '#00000000' } },
            { type: 'group', id: fresh(), clip: { source: id }, children },
          ];
          clipped = true;
        }
        nodes[i] = {
          type: 'group',
          id: node.id,
          ...Object.fromEntries(
            groupKeys.filter((k) => node[k] !== undefined).map((k) => [k, node[k]]),
          ),
          children,
        };
      }
    };
    visit(definition.nodes);
  };
  convert(out, doc, '');
  for (const [name, definition] of Object.entries((out.components ?? {}) as ObjectValue)) {
    const original = (doc.components as Record<string, ObjectValue>)[name]!;
    const source = {
      anima: doc.anima,
      name: 'flatten-component',
      requires: doc.requires,
      components: doc.components,
      ...original,
      ...(original.data || doc.data
        ? {
            data:
              typeof original.data === 'string'
                ? { ...(doc.data as ObjectValue), model: original.data }
                : (original.data ?? doc.data),
          }
        : {}),
    };
    convert(definition as ObjectValue, source, name + '/');
  }
  if (nodeId && !found) fail('no text node with id ' + nodeId);
  if (found)
    out.requires = [
      ...new Set([
        ...(Array.isArray(out.requires) ? out.requires : []),
        'paint',
        ...(clipped ? ['composite'] : []),
      ]),
    ];
  const checked = load(out);
  if (!checked.model)
    fail(
      'flattened document has remaining text references: ' +
        checked.diagnostics.map((d) => d.message).join('; '),
    );
  return out;
}

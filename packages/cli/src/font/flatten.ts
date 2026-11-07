import { load, Player, toSVG } from '@anima-format/core';
import { importSVG } from '../import-svg.ts';
import { fault } from './binary.ts';
import type { ToolMeasurer } from './measure.ts';
import { outlineSVG } from './svg.ts';

/** Freeze authored/default text into editable geometry; preserve the surrounding document. */
export function flattenText(
  doc: Record<string, unknown>,
  measurer: ToolMeasurer,
  nodeId?: string,
): Record<string, unknown> {
  const out = structuredClone(doc);
  let found = false,
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
  const transformKeys = [
    'x',
    'y',
    'rotate',
    'scale',
    'scaleX',
    'scaleY',
    'opacity',
    'visible',
    'pivot',
    'a11y',
  ];
  const visit = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i] as Record<string, unknown>;
      if (node.type === 'text' && (!nodeId || node.id === nodeId)) {
        found = true;
        const local = Object.fromEntries(
          Object.entries(node).filter(([k]) => !transformKeys.includes(k)),
        );
        const standalone: Record<string, unknown> = {
          ...Object.fromEntries(
            Object.entries(out).filter(
              ([k]) => !['timelines', 'layers', 'listeners', 'inputs', 'machines'].includes(k),
            ),
          ),
          nodes: [local],
        };
        const result = load(standalone);
        if (!result.model)
          fault(
            'cannot flatten text: ' + result.diagnostics.map((d) => d.message).join('; '),
            'font-flatten',
          );
        const player = new Player(result.model);
        player.step(0);
        const svg = outlineSVG(toSVG(player), measurer),
          imported = importSVG(svg, 'flattened');
        if (imported.diagnostics.length)
          fault(
            'outline conversion cannot preserve SVG feature: ' + imported.diagnostics[0]!.message,
            'font-flatten',
          );
        const children = imported.doc.nodes as Record<string, unknown>[];
        const rename = (nodes: Record<string, unknown>[]) =>
          nodes.forEach((n) => {
            n.id = fresh();
            if (Array.isArray(n.children)) rename(n.children as Record<string, unknown>[]);
          });
        rename(children);
        nodes[i] = {
          type: 'group',
          id: node.id,
          ...Object.fromEntries(
            transformKeys.filter((k) => node[k] !== undefined).map((k) => [k, node[k]]),
          ),
          children,
        };
      } else visit(node.children);
    }
  };
  visit(out.nodes);
  if (nodeId && !found) fault('no text node with id ' + nodeId, 'font-flatten');
  if (found)
    out.requires = [...new Set([...(Array.isArray(out.requires) ? out.requires : []), 'paint'])];
  const checked = load(out);
  if (!checked.model)
    fault(
      'flattened document has remaining text references: ' +
        checked.diagnostics.map((d) => d.message).join('; '),
      'font-flatten',
    );
  return out;
}

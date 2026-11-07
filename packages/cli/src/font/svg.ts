import { parseXml, type Element } from '../../../markup/src/xml.ts';
import { fault } from './binary.ts';
import { type FontSpec, ToolMeasurer } from './measure.ts';

const xml = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const attr = (e: Element) => Object.fromEntries(e.attrs.map((a) => [a.name, a.value]));
const attrs = (a: Record<string, string>) =>
  Object.entries(a)
    .map(([k, v]) => ` ${k}="${xml(v)}"`)
    .join('');
const num = (value: string | undefined, fallback: number) => {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n))
    fault(
      'text outline conversion needs scalar SVG positions and grid-unit sizes',
      'font-unsupported',
    );
  return n;
};
const settings = (s: string | undefined) =>
  s
    ? Object.fromEntries(
        [...s.matchAll(/['"]([\w ]{4})['"]\s+(-?[\d.]+)/g)].map((m) => [m[1]!, Number(m[2])]),
      )
    : undefined;
/** Replace SVG text/tspan with paths, retaining inherited paint, transforms and clipping. */
export function outlineSVG(svg: string, measurer: ToolMeasurer): string {
  if (!/<text[\s>]/.test(svg)) return svg;
  const parsed = parseXml(svg);
  if (!parsed.doc.root) fault('cannot parse rendered SVG');
  const render = (
    element: Element,
    inherited: Record<string, string>,
    pen?: { x: number; y: number },
  ): string => {
    const own = attr(element),
      a = { ...inherited, ...own },
      isText = element.name === 'text' || element.name === 'tspan';
    let content = '';
    if (isText) {
      pen ??= { x: 0, y: 0 };
      pen.x = num(own.x, pen.x) + num(own.dx, 0);
      pen.y = num(own.y, pen.y) + num(own.dy, 0);
      const spec: FontSpec = {
        family: a['font-family'] ?? 'sans-serif',
        size: num(a['font-size'], 16),
        weight: a['font-weight'] === 'bold' ? 700 : num(a['font-weight'], 400),
        style: a['font-style'] === 'italic' ? 'italic' : 'normal',
        tracking: num(a['letter-spacing'], 0),
        axes: settings(a['font-variation-settings']),
        features: settings(a['font-feature-settings']),
      };
      if (a.direction === 'rtl')
        fault(
          'RTL outline conversion requires shaping; use --browser-text to render',
          'font-unsupported',
        );
      for (const child of element.children) {
        if (child.kind === 'text') {
          const m = measurer.measure(spec, child.value),
            width = m.advances.at(-1) ?? 0;
          let x = pen.x;
          if (own['text-anchor'] === 'middle') x -= width / 2;
          else if (own['text-anchor'] === 'end') x -= width;
          const path = measurer.outline(spec, child.value, x, pen.y);
          content += `<path d="${path}"/>`;
          pen.x += width;
        } else if (child.kind === 'element') content += render(child, a, pen);
      }
      const group = Object.fromEntries(
        Object.entries(own).filter(
          ([k]) =>
            !k.startsWith('font-') &&
            ![
              'letter-spacing',
              'word-spacing',
              'direction',
              'dominant-baseline',
              'alignment-baseline',
              'x',
              'y',
              'dx',
              'dy',
              'text-anchor',
              'rotate',
              'textLength',
              'lengthAdjust',
            ].includes(k),
        ),
      );
      if (own.rotate && own.rotate !== '0')
        fault(
          'SVG glyph rotations are not implemented by the outline converter',
          'font-unsupported',
        );
      return `<g${attrs(group)}>${content}</g>`;
    }
    for (const child of element.children)
      content +=
        child.kind === 'element' ? render(child, a) : child.kind === 'text' ? xml(child.value) : '';
    return `<${element.name}${attrs(own)}>${content}</${element.name}>`;
  };
  return render(parsed.doc.root, {});
}

import '@anima-format/core/all';
// Every runtime module (generated), so any conformance case or example can play here.
import '../../../../packages/web/src/all-modules.ts';
import {
  runScript,
  drawFrame,
  sceneTree,
  svgAttrs,
  cssSlots,
  type El,
  type Attrs,
} from '@anima-format/core';
import { AnimaIcon } from '../../../../packages/web/src/index.ts';
import '../../web/index.ts';
import type { CanvasRenderer } from '../../web/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
let renderer: CanvasRenderer;
const factory = Icon.renderers.canvas!;
Icon.renderers.canvas = (icon) => (renderer = factory(icon) as CanvasRenderer);
const harness = {
  icon: undefined as unknown as AnimaIcon,
  errors: [] as { code: string; pointer: string; message: string; hint?: string }[],
  get renderer() {
    return renderer;
  },
  async mount(doc: object, backend: string, script = '') {
    this.icon?.destroy();
    document.body.replaceChildren();
    this.errors = [];
    const icon = (this.icon = document.createElement('anima-icon'));
    icon.setAttribute('paused', '');
    icon.setAttribute('renderer', backend);
    icon.style.cssText = 'width:240px;height:240px;color:#000;';
    icon.addEventListener('anima:error', (e) => this.errors.push(...(e as CustomEvent).detail));
    document.body.append(icon);
    icon.load(doc);
    await icon.ready;
    const m = icon.player!.model;
    icon.style.width = (240 * m.grid) / m.viewBox[2] + 'px';
    icon.style.height = (240 * m.grid) / m.viewBox[3] + 'px';
    icon.style.marginLeft = 48 - (240 * m.viewBox[0]) / m.viewBox[2] + 'px';
    icon.style.marginTop = 48 - (240 * m.viewBox[1]) / m.viewBox[3] + 'px';
    if (script) icon.player = runScript(m, script).player;
    if (backend === 'canvas') renderer.layout();
    icon.invalidate();
    if (backend === 'canvas') {
      await renderer.ready;
      icon.invalidate();
    }
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  },
  unchanged() {
    const before = renderer.draws;
    renderer.draw(drawFrame(this.icon.player!), false);
    return renderer.draws - before;
  },
  perf() {
    const p = this.icon.player!;
    // Same retained attribute diff as the host, without scheduling, events or vsync.
    // Canvas keeps its original step + renderer.draw workload.
    const svg = this.icon.shadowRoot!.querySelector('svg');
    const tree = sceneTree(p.model);
    const flatten = (el: El): El[] => [el, ...el.kids.flatMap(flatten)];
    const els = [...tree.defs.flatMap(flatten), ...tree.root.flatMap(flatten)];
    const dom = svg ? [...svg.querySelectorAll('*')].filter((el) => el.localName !== 'defs') : [];
    const records = els.map((el, i) => [el, dom[i]!, {} as Attrs] as const);
    const draw = () => {
      const f = drawFrame(p);
      if (!svg) return renderer.draw(f, false);
      const changed = new Set(f.changed);
      for (const [el, d, cur] of records) {
        if (!changed.has(el.node)) continue;
        const next = svgAttrs(f, el, cssSlots, 'perf');
        for (const k in next) {
          const v = next[k]!;
          if (v === cur[k]) continue;
          if (v === null) d.removeAttribute(k);
          else d.setAttribute(k, v);
          cur[k] = v;
        }
      }
      Icon.orderSVG?.(
        f,
        records.map(([el, d, cur]) => [el, d, cur]),
      );
    };
    const run = () => {
      const t = performance.now();
      for (let i = 0; i < 600; i++) {
        if (i % 90 === 0 && p.model.inputs.has('ring')) p.fire('ring');
        p.step(1 / 60);
        draw();
      }
      return ((performance.now() - t) * 1000) / 600;
    };
    run();
    return [run(), run(), run()].sort((a, b) => a - b)[1]!;
  },
};
window.canvasTest = harness;
declare global {
  interface Window {
    canvasTest: typeof harness;
  }
}

// Canvas2D consumes only the resolved draw frame. No second player or SVG rasterization.
import type { CanvasSourceHost } from './sources.ts';
import type { AnimaIcon, IconRenderer } from '../../../packages/web/src/index.ts';
import type { DrawColor, DrawFrame, DrawPaint, Geometry, Mat } from '@anima-format/core';
import { drawOrder, geometryLength, IDENTITY, mul, invert } from '@anima-format/core';

type Ctx = CanvasRenderingContext2D;
const context = (c: HTMLCanvasElement) => c.getContext('2d')!;
const matrix = (m: Mat) => new DOMMatrix(m);
function path(g?: Geometry): Path2D {
  const p = new Path2D(g?.d);
  if (!g || g.d) return p;
  if (g.kind === 'circle') p.arc(g.cx!, g.cy!, g.r!, 0, Math.PI * 2);
  else if (g.kind === 'rect' || g.kind === 'image')
    p.roundRect(g.x!, g.y!, g.width!, g.height!, g.rx ?? 0);
  return p;
}
export class CanvasRenderer implements IconRenderer {
  readonly canvas = document.createElement('canvas');
  #icon: AnimaIcon;
  #frame?: DrawFrame;
  #sourcePointer?: string;
  #target = this.canvas;
  #revision = -1;
  #viewport: Mat = [...IDENTITY];
  #world: Mat[] = [];
  #hidden = new Set<number>();
  #reported = new Set<string>();
  #images = new Map<string, HTMLImageElement>();
  #tiles = new Map<string, HTMLCanvasElement>();
  #pending = new Set<Promise<void>>();
  #paths = new Map<Geometry, Path2D>();
  #resize = new ResizeObserver(() => this.layout());
  #attributes = new MutationObserver(() => this.layout());
  #resolution?: MediaQueryList;
  #alive = true;
  #style!: CSSStyleDeclaration;
  #pool: HTMLCanvasElement[] = [];
  #used = 0;
  draws = 0;
  get ready(): Promise<unknown[]> {
    return Promise.all(this.#pending);
  }
  constructor(icon: AnimaIcon) {
    this.#icon = icon;
    const style = document.createElement('style');
    style.textContent =
      ':host{display:inline-block;position:relative;width:1em;height:1em;vertical-align:-.125em;touch-action:manipulation;-webkit-tap-highlight-color:transparent}canvas{position:absolute;pointer-events:none}';
    this.canvas.setAttribute('aria-hidden', 'true');
    icon.shadowRoot!.replaceChildren(style, this.canvas);
    this.connect();
  }
  connect(): void {
    this.#resize.observe(this.#icon);
    this.#attributes.observe(this.#icon, { attributes: true, attributeFilter: ['pixel-ratio'] });
    addEventListener('resize', this.#dpr);
    this.#dpr();
  }
  disconnect(): void {
    this.#resize.disconnect();
    this.#attributes.disconnect();
    removeEventListener('resize', this.#dpr);
    this.#resolution?.removeEventListener('change', this.#dpr);
  }
  destroy(): void {
    this.#alive = false;
    this.disconnect();
    this.#pool = [];
    this.#images.clear();
    this.#tiles.clear();
    this.#paths.clear();
    this.#frame = undefined;
    this.canvas.width = this.canvas.height = 1;
  }
  #dpr = (): void => {
    this.#resolution?.removeEventListener('change', this.#dpr);
    this.#resolution = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    this.#resolution.addEventListener('change', this.#dpr);
    this.layout();
  };
  get pixelRatio(): number {
    const attr = this.#icon.getAttribute('pixel-ratio');
    const ratio = attr === null ? devicePixelRatio : Number(attr);
    if (Number.isFinite(ratio) && ratio > 0) return ratio;
    this.#diagnostic(
      'pixel-ratio',
      '',
      'bad-pixel-ratio',
      'use a finite positive pixel-ratio or remove the attribute',
    );
    return devicePixelRatio;
  }
  layout(): void {
    const m = this.#icon.player?.model;
    if (!m) return;
    const [x, y, w, h] = m.viewBox,
      g = m.grid;
    const css = getComputedStyle(this.#icon);
    const host = { width: parseFloat(css.width), height: parseFloat(css.height) };
    const fit = this.#icon.getAttribute('fit');
    const align = this.#icon.getAttribute('align') ?? 'center';
    const factor = (lo: string, hi: string) =>
      align.includes(lo) ? 0 : align.includes(hi) ? 1 : 0.5;
    const cw = fit === 'none' ? w : (host.width * w) / g;
    const ch = fit === 'none' ? h : (host.height * h) / g;
    Object.assign(this.canvas.style, {
      width: cw + 'px',
      height: ch + 'px',
      left:
        (fit === 'none' ? (host.width - w) * factor('left', 'right') : (host.width * x) / g) + 'px',
      top:
        (fit === 'none' ? (host.height - h) * factor('top', 'bottom') : (host.height * y) / g) +
        'px',
    });
    const width = Math.max(1, Math.round(cw * this.pixelRatio));
    const height = Math.max(1, Math.round(ch * this.pixelRatio));
    let sx = cw / w,
      sy = ch / h;
    if (fit !== 'fill') sx = sy = (fit === 'cover' ? Math.max : Math.min)(sx, sy);
    const vx: Mat = [
      sx,
      0,
      0,
      sy,
      (cw - w * sx) * factor('left', 'right') - x * sx,
      (ch - h * sy) * factor('top', 'bottom') - y * sy,
    ];
    const next: Mat = [
      (vx[0] * width) / cw,
      0,
      0,
      (vx[3] * height) / ch,
      (vx[4] * width) / cw,
      (vx[5] * height) / ch,
    ];
    if (!cw || !ch) return;
    const changed =
      width !== this.canvas.width ||
      height !== this.canvas.height ||
      next.some((v, i) => v !== this.#viewport[i]);
    if (changed) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.#viewport = next;
      if (this.#frame) this.draw(this.#frame, true);
    }
  }
  point(x: number, y: number): DOMPoint {
    const b = this.canvas.getBoundingClientRect();
    return new DOMPoint(
      ((x - b.x) * this.canvas.width) / b.width,
      ((y - b.y) * this.canvas.height) / b.height,
    ).matrixTransform(matrix(this.#viewport).inverse());
  }
  /** Map a resolved world node box through this backend's current viewport. */
  nodeBox([x, y, w, h]: [number, number, number, number]): DOMRect {
    const r = this.canvas.getBoundingClientRect(),
      m = this.#viewport,
      sx = r.width / this.canvas.width,
      sy = r.height / this.canvas.height;
    return new DOMRect(
      r.x + (m[0] * x + m[4]) * sx,
      r.y + (m[3] * y + m[5]) * sy,
      w * m[0] * sx,
      h * m[3] * sy,
    );
  }
  #diagnostic(
    feature: string,
    pointer: string,
    code = 'unsupported-render',
    hint = 'use the SVG renderer or remove this feature',
  ): void {
    pointer = this.#sourcePointer ?? pointer;
    const key = feature + pointer;
    if (this.#reported.has(key)) return;
    this.#reported.add(key);
    this.#icon.dispatchEvent(
      new CustomEvent('anima:error', {
        detail: [
          {
            code,
            severity: 'error',
            pointer,
            message: `Canvas2D cannot render ${feature}`,
            hint,
          },
        ],
      }),
    );
  }
  #unsupported(feature: string, i: number, key = ''): void {
    const resource = this.#frame!.tree.resources.find(
      (r) => r.node === i && r.kind === 'surface' && r.key === key,
    );
    this.#diagnostic(
      feature,
      (resource?.pointer ?? '/nodes/' + i) + (resource ? '' : key ? '/' + key : ''),
    );
  }
  #surface(): HTMLCanvasElement {
    const index = this.#used++;
    const c = (this.#pool[index] ??= document.createElement('canvas'));
    if (c.width !== this.#target.width || c.height !== this.#target.height) {
      c.width = this.#target.width;
      c.height = this.#target.height;
    } else context(c).reset();
    return c;
  }

  #image(src: string): HTMLImageElement | undefined {
    let img = this.#images.get(src);
    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      this.#images.set(src, img);
      const pending = img
        .decode()
        .then(
          () => {
            if (this.#alive) this.#icon.invalidate();
          },
          () => {
            if (this.#alive)
              this.#diagnostic(
                'image source',
                '',
                'asset-load',
                'check the image URL and CORS headers',
              );
          },
        )
        .finally(() => this.#pending.delete(pending));
      this.#pending.add(pending);
    }
    return img.complete && img.naturalWidth ? img : undefined;
  }
  #color(c?: DrawColor): string {
    let value =
      typeof c === 'object'
        ? this.#style.getPropertyValue('--anima-' + c.slot).trim() || c.fallback
        : (c ?? '#000');
    if (value === 'currentColor') value = this.#style.color;
    return value;
  }
  #path(g?: Geometry): Path2D {
    if (!g) return new Path2D();
    let p = this.#paths.get(g);
    if (!p) {
      p = path(g);
      this.#paths.set(g, p);
    }
    return p;
  }
  draw(f: DrawFrame, force: boolean): void {
    this.#frame = f;
    if (!force && this.#revision === f.revision) return;
    this.#revision = f.revision;
    this.#used = 0;
    this.#style = getComputedStyle(this.#icon);
    this.#paths.clear();
    this.#prepare(f);
    const ctx = context(this.canvas);
    ctx.resetTransform();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(...this.#viewport);
    this.#list(ctx, f.tree.roots, IDENTITY);
    this.draws++;
  }
  #prepare(f: DrawFrame): void {
    this.#world = [];
    const world = (i: number): Mat =>
      (this.#world[i] ??= mul(
        f.tree.nodes[i]!.parent < 0 ? IDENTITY : world(f.tree.nodes[i]!.parent),
        f.nodes[i]!.transform,
      ));
    for (let i = 0; i < f.nodes.length; i++) world(i);
    this.#hidden = new Set(
      f.nodes.flatMap((n) => (n.mask?.sourceDraws === false ? [n.mask.source] : [])),
    );
  }
  #source = (f: DrawFrame, width: number, height: number, pointer: string): HTMLCanvasElement => {
    const saved = [
      this.#frame,
      this.#viewport,
      this.#world,
      this.#hidden,
      this.#target,
      this.#sourcePointer,
    ] as const;
    const tile = document.createElement('canvas');
    tile.width = width;
    tile.height = height;
    const [x, y, w, h] = f.viewBox;
    this.#sourcePointer ??= pointer;
    this.#frame = f;
    this.#target = tile;
    this.#viewport = [width / w, 0, 0, height / h, (-x * width) / w, (-y * height) / h];
    try {
      this.#prepare(f);
      const ctx = context(tile);
      ctx.setTransform(...this.#viewport);
      this.#list(ctx, f.tree.roots, IDENTITY);
      return tile;
    } finally {
      [this.#frame, this.#viewport, this.#world, this.#hidden, this.#target, this.#sourcePointer] =
        saved;
    }
  };
  #list(ctx: Ctx, list: number[], parent: Mat, source = false): void {
    const order = drawOrder(this.#frame!, list);
    // Knockouts affect only the preceding siblings, never the parent's backdrop.
    const isolated = order.some((i) => this.#frame!.tree.nodes[i]!.knockout !== undefined);
    const layer = isolated ? this.#surface() : undefined;
    const out = layer ? context(layer) : ctx;
    if (layer) out.setTransform(ctx.getTransform());
    for (const i of order) {
      const entry = this.#frame!.tree.nodes[i]!,
        n = this.#frame!.nodes[i]!;
      if (entry.knockout !== undefined && n.visible) {
        out.save();
        out.transform(...n.transform);
        out.globalCompositeOperation = 'destination-out';
        out.fillStyle = '#000';
        out.strokeStyle = '#000';
        out.globalAlpha *= n.opacity;
        out.lineCap = 'round';
        out.lineJoin = 'round';
        const fill = n.paints.find((p) => p.kind === 'fill'),
          stroke = n.paints.find((p) => p.kind === 'stroke');
        if (fill) out.fill(this.#path(n.geometry), fill.rule as CanvasFillRule);
        out.lineWidth = (stroke?.width ?? 0) + entry.knockout * 2;
        if (out.lineWidth > 0 && (fill || stroke)) out.stroke(this.#path(n.geometry));
        out.restore();
      }
      this.#node(out, i, mul(parent, n.transform), source);
    }
    if (layer) {
      ctx.save();
      ctx.resetTransform();
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }
  }
  #node(ctx: Ctx, i: number, world: Mat, source = false, stack = new Set<number>()): void {
    const f = this.#frame!,
      n = f.nodes[i]!,
      e = f.tree.nodes[i]!;
    if (!n.visible || n.opacity === 0 || (!source && this.#hidden.has(i)) || stack.has(i)) return;
    stack = new Set(stack).add(i);
    const isolate =
      // seam(P7-2): opacity isolates a painted container together with its children.
      (n.opacity !== 1 &&
        (!n.geometry || e.children.length > 0 || n.paints.filter((p) => p.visible).length > 1)) ||
      !!n.mask ||
      (!!n.blend && n.blend !== 'normal');
    const layer = isolate ? this.#surface() : undefined;
    const out = layer ? context(layer) : ctx;
    out.save();
    if (!layer) out.globalAlpha *= n.opacity;
    out.setTransform(...mul(this.#viewport, world));
    if (n.clip) {
      const s = f.nodes[n.clip.source]!;
      out.setTransform(...this.#viewport);
      const clip = new Path2D();
      clip.addPath(this.#path(s.geometry), matrix(this.#world[n.clip.source]!));
      out.clip(clip, n.clip.rule as CanvasFillRule);
      out.setTransform(...mul(this.#viewport, world));
    }
    const content = (target: Ctx, basis: Mat) => {
      if (
        (this.#icon.constructor as CanvasSourceHost).canvasShapes?.some((hook) =>
          hook(target, n, (p) => (p.type ? this.#gradient(target, p) : this.#color(p.color))),
        )
      )
        return;
      if (n.geometry) this.#shape(target, i, basis);
      // seam(P7-2): painted layout containers also draw their children.
      if (e.children.length) this.#list(target, e.children, basis, source);
    };
    if (n.patches) {
      const inv = invert(world);
      if (inv)
        for (const patch of n.patches) {
          if (patch.mode === 'hidden') continue;
          const [sx, sy, sw, sh] = patch.source as [number, number, number, number];
          const [x, y, w, h] = patch.target as [number, number, number, number];
          if (!sw || !sh || !w || !h) continue;
          out.save();
          out.beginPath();
          out.rect(x, y, w, h);
          out.clip();
          const tw = patch.mode === 'repeat' ? sw : w,
            th = patch.mode === 'repeat' ? sh : h;
          for (let dy = 0; dy < h; dy += th)
            for (let dx = 0; dx < w; dx += tw) {
              out.save();
              out.beginPath();
              out.rect(x + dx, y + dy, Math.min(tw, w - dx), Math.min(th, h - dy));
              out.clip();
              const map: Mat = [
                tw / sw,
                0,
                0,
                th / sh,
                x + dx - (sx * tw) / sw,
                y + dy - (sy * th) / sh,
              ];
              const basis = mul(world, map);
              out.setTransform(...mul(this.#viewport, basis));
              content(out, basis);
              out.restore();
            }
          out.restore();
        }
    } else content(out, world);
    out.restore();
    if (layer) {
      if (n.mask) {
        const mask = this.#surface(),
          mc = context(mask);
        this.#node(mc, n.mask.source, this.#world[n.mask.source]!, true, stack);
        if (n.mask.mode.endsWith('luminance')) {
          const pixels = mc.getImageData(0, 0, mask.width, mask.height);
          for (let k = 0; k < pixels.data.length; k += 4)
            pixels.data[k + 3] =
              (pixels.data[k + 3]! *
                (0.2126 * pixels.data[k]! +
                  0.7152 * pixels.data[k + 1]! +
                  0.0722 * pixels.data[k + 2]!)) /
              255;
          mc.putImageData(pixels, 0, 0);
        }
        {
          out.save();
          out.resetTransform();
          out.globalCompositeOperation = n.mask.mode.startsWith('inverted-')
            ? 'destination-out'
            : 'destination-in';
          out.drawImage(mask, 0, 0);
          out.restore();
        }
      }
      ctx.save();
      ctx.resetTransform();
      ctx.globalAlpha *= n.opacity;
      ctx.globalCompositeOperation = (
        n.blend !== 'additive' && (n.mask || n.clip || n.blend === 'normal')
          ? 'source-over'
          : n.blend === 'additive'
            ? 'lighter'
            : (n.blend ?? 'source-over')
      ) as GlobalCompositeOperation;
      this.#blendImage(ctx, layer, n.blend, n.blendAmount ?? 1);
      ctx.restore();
    }
  }
  #blendImage(ctx: Ctx, source: HTMLCanvasElement, mode: string | undefined, amount: number): void {
    if (mode === 'additive' && amount > 0 && amount < 1) {
      // Evaluate once in premultiplied space: two 8-bit draws round the source twice.
      const w = source.width,
        h = source.height;
      const src = context(source).getImageData(0, 0, w, h).data;
      const dst = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < src.length; i += 4) {
        const sa = (src[i + 3]! / 255) * ctx.globalAlpha;
        const da = dst.data[i + 3]! / 255;
        const keep = 1 - sa * (1 - amount);
        const alpha = Math.min(1, sa + da * keep);
        for (let k = 0; k < 3; k++)
          dst.data[i + k] = alpha
            ? Math.min(255, (src[i + k]! * sa + dst.data[i + k]! * da * keep) / alpha)
            : 0;
        dst.data[i + 3] = alpha * 255;
      }
      const result = this.#surface();
      context(result).putImageData(dst, 0, 0);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(result, 0, 0);
      ctx.restore();
    } else {
      if (mode === 'additive') ctx.globalCompositeOperation = amount ? 'lighter' : 'source-over';
      ctx.drawImage(source, 0, 0);
    }
  }

  #shape(ctx: Ctx, i: number, world: Mat): void {
    const n = this.#frame!.nodes[i]!,
      g = n.geometry!,
      p = this.#path(g);
    if (g.image) {
      const image = this.#image(g.image.source);
      if (!image) return;
      const r = g.image,
        w = g.width!,
        h = g.height!,
        iw = r.width ?? image.naturalWidth,
        ih = r.height ?? image.naturalHeight;
      if (!w || !h) return;
      const sx = w / iw,
        sy = h / ih;
      const scale =
        r.fit === 'cover'
          ? Math.max(sx, sy)
          : r.fit === 'none'
            ? 1
            : r.fit === 'scale-down'
              ? Math.min(1, sx, sy)
              : r.fit === 'fit-width'
                ? sx
                : r.fit === 'fit-height'
                  ? sy
                  : Math.min(sx, sy);
      const dw = r.fit === 'fill' || r.fit === 'resize' ? w : iw * scale,
        dh = r.fit === 'fill' || r.fit === 'resize' ? h : ih * scale;
      const factor = (lo: string, hi: string) =>
        r.align.includes(lo) ? 0 : r.align.includes(hi) ? 1 : 0.5;
      ctx.save();
      ctx.imageSmoothingEnabled = r.sampling !== 'nearest';
      const x = g.x! + (w - dw) * factor('left', 'right'),
        y = g.y! + (h - dh) * factor('top', 'bottom');
      if (this.#frame!.tree.nodes[i]!.imageWrap) {
        ctx.beginPath();
        ctx.rect(g.x!, g.y!, w, h);
        ctx.clip();
        const axes = (
          mode: string | undefined,
          pos: number,
          size: number,
          lo: number,
          box: number,
        ) =>
          mode === 'clamp'
            ? [
                [-1, lo, Math.max(0, pos - lo)],
                [0, pos, size],
                [1, pos + size, Math.max(0, lo + box - pos - size)],
              ]
            : [[0, lo, box]];
        const layer =
          (r.wrapX === 'clamp' && dw < w) || (r.wrapY === 'clamp' && dh < h)
            ? this.#surface()
            : undefined;
        const out = layer ? context(layer) : ctx;
        if (layer) {
          out.setTransform(ctx.getTransform());
          // Sum adjacent slice coverage once. Source-over would leave seams
          // at fractional slice boundaries, including translucent edge texels.
          out.globalCompositeOperation = 'lighter';
          out.imageSmoothingEnabled = ctx.imageSmoothingEnabled;
        }
        const nw = image.naturalWidth,
          nh = image.naturalHeight;
        for (const [cx, dx, cw] of axes(r.wrapX, x, dw, g.x!, w))
          for (const [cy, dy, ch] of axes(r.wrapY, y, dh, g.y!, h)) {
            if (!cw || !ch) continue;
            const mx = !cx && r.wrapX === 'mirror',
              my = !cy && r.wrapY === 'mirror';
            const px = !cx && r.wrapX === 'clamp' ? 1 : 0,
              py = !cy && r.wrapY === 'clamp' ? 1 : 0;
            const tw = cx ? 1 : nw * (mx ? 2 : 1),
              th = cy ? 1 : nh * (my ? 2 : 1);
            const key = JSON.stringify([r.source, cx, cy, mx, my, px, py]);
            let tile = this.#tiles.get(key);
            if (!tile) {
              tile = document.createElement('canvas');
              tile.width = tw + 2 * px;
              tile.height = th + 2 * py;
              const tc = context(tile);
              // Isolate exact texels before filtering. Padding prevents periodic
              // interpolation from leaking the opposite edge onto a clamped axis.
              tc.imageSmoothingEnabled = false;
              const slices = (edge: number, mirror: boolean, pad: number, size: number) => {
                if (edge) return [[edge < 0 ? 0 : size - 1, 1, 0, 1]];
                const list = [[0, size, pad, size]];
                if (mirror) list.push([0, size, pad + size * 2, -size]);
                if (pad) list.push([0, 1, 0, 1], [size - 1, 1, pad + size, 1]);
                return list;
              };
              for (const [sx, sw, dx, dw] of slices(cx!, mx, px, nw))
                for (const [sy, sh, dy, dh] of slices(cy!, my, py, nh)) {
                  tc.save();
                  tc.translate(dx!, dy!);
                  tc.scale(Math.sign(dw!), Math.sign(dh!));
                  tc.drawImage(image, sx!, sy!, sw!, sh!, 0, 0, Math.abs(dw!), Math.abs(dh!));
                  tc.restore();
                }
              this.#tiles.set(key, tile);
            }
            const pattern = out.createPattern(tile, 'repeat')!;
            pattern.setTransform(
              new DOMMatrix([dw / nw, 0, 0, dh / nh, x - (px * dw) / nw, y - (py * dh) / nh]),
            );
            out.fillStyle = pattern;
            out.fillRect(dx!, dy!, cw!, ch!);
          }
        if (layer) {
          ctx.resetTransform();
          ctx.drawImage(layer, 0, 0);
        }
      } else if (r.sampling === 'nearest') {
        // Nearest drawImage snaps its outer edges. Extend the border texels into
        // the one-device-pixel AA fringe, then let a geometric clip own coverage.
        // Unlike a repeating shader, this clamps colours at fractional boundaries.
        // Intersect fitted image and viewport before clipping: two coincident
        // fractional clips would multiply coverage instead of preserving it.
        const left = Math.max(g.x!, x),
          top = Math.max(g.y!, y);
        const right = Math.min(g.x! + w, x + dw),
          bottom = Math.min(g.y! + h, y + dh);
        ctx.beginPath();
        ctx.rect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
        ctx.clip();
        const inv = ctx.getTransform().inverse();
        const px = Math.abs(inv.a) + Math.abs(inv.c),
          py = Math.abs(inv.b) + Math.abs(inv.d);
        const iw = image.naturalWidth,
          ih = image.naturalHeight;
        for (const [sx, sw, dx, width] of [
          [0, 1, x - px, px],
          [0, iw, x, dw],
          [iw - 1, 1, x + dw, px],
        ])
          for (const [sy, sh, dy, height] of [
            [0, 1, y - py, py],
            [0, ih, y, dh],
            [ih - 1, 1, y + dh, py],
          ])
            ctx.drawImage(image, sx!, sy!, sw!, sh!, dx!, dy!, width!, height!);
      } else {
        ctx.beginPath();
        ctx.rect(g.x!, g.y!, w, h);
        ctx.clip();
        ctx.drawImage(image, x, y, dw, dh);
      }
      ctx.restore();
      return;
    }
    for (const paint of n.paints) {
      if (!paint.visible) continue;
      ctx.save();
      const amount = paint.blendAmount ?? 1;
      const layer = paint.blend === 'additive' && amount < 1 ? this.#surface() : undefined;
      const out = layer ? context(layer) : ctx;
      if (layer) out.setTransform(ctx.getTransform());
      if (paint.blend && !layer)
        out.globalCompositeOperation = (
          paint.blend === 'normal'
            ? 'source-over'
            : paint.blend === 'additive'
              ? 'lighter'
              : paint.blend
        ) as GlobalCompositeOperation;
      const feather = paint.feather;
      if (feather?.enabled && (feather.inner || feather.outer || feather.offset.some(Boolean))) {
        const base = this.#surface(),
          bc = context(base);
        bc.setTransform(out.getTransform());
        this.#paint(bc, i, paint, p, world);
        this.#feather(out, base, paint, i, world);
      } else this.#paint(out, i, paint, p, world);
      if (layer) {
        ctx.resetTransform();
        this.#blendImage(ctx, layer, paint.blend, amount);
      }
      ctx.restore();
    }
  }
  #feather(ctx: Ctx, base: HTMLCanvasElement, paint: DrawPaint, i: number, world: Mat): void {
    const r = paint.feather!,
      m = r.space === 'world' ? this.#viewport : mul(this.#viewport, world);
    const sx = Math.hypot(m[0], m[1]),
      sy = Math.hypot(m[2], m[3]);
    if (Math.abs(sx - sy) > 1e-5 || Math.abs(m[0] * m[2] + m[1] * m[3]) > 1e-5) {
      this.#unsupported(
        r.space === 'world' ? 'nonuniform viewport feather' : 'nonuniform local feather',
        i,
        paint.key,
      );
      return;
    }
    // Offset remains a local vector (SPEC feather); space changes the Gaussian metric only.
    const shift = mul(this.#viewport, world);
    const ox = shift[0] * r.offset[0] + shift[2] * r.offset[1],
      oy = shift[1] * r.offset[0] + shift[3] * r.offset[1];
    const sum = this.#surface(),
      sc = context(sum);
    for (const part of ['inner', 'outer'] as const) {
      const c = this.#surface(),
        cc = context(c);
      cc.filter = `blur(${(r[part] * sx) / 3}px)`;
      cc.drawImage(base, ox, oy);
      cc.filter = 'none';
      cc.globalCompositeOperation = part === 'inner' ? 'destination-in' : 'destination-out';
      cc.drawImage(base, 0, 0);
      sc.globalCompositeOperation = 'lighter';
      sc.drawImage(c, 0, 0);
    }
    ctx.save();
    ctx.resetTransform();
    ctx.drawImage(sum, 0, 0);
    ctx.restore();
  }
  #gradient(ctx: Ctx, p: DrawPaint): CanvasGradient {
    const c = p.coordinates!;
    const gradient =
      p.type === 'linear'
        ? ctx.createLinearGradient(c.x1!, c.y1!, c.x2!, c.y2!)
        : p.type === 'angular'
          ? ctx.createConicGradient(Math.atan2(c.y2! - c.y1!, c.x2! - c.x1!), c.x1!, c.y1!)
          : ctx.createRadialGradient(c.fx ?? c.cx!, c.fy ?? c.cy!, 0, c.cx!, c.cy!, c.r!);
    for (const stop of p.stops!) gradient.addColorStop(stop.position, this.#color(stop.color));
    return gradient;
  }
  #paint(ctx: Ctx, i: number, p: DrawPaint, local: Path2D, world: Mat): void {
    if (p.geometry) local = this.#path(p.geometry);
    let style: string | CanvasGradient | CanvasPattern = this.#color(p.color);
    if (p.type && p.gradientTransform) {
      const mask = this.#surface(),
        mc = context(mask),
        layer = this.#surface(),
        lc = context(layer);
      mc.setTransform(ctx.getTransform());
      this.#paint(
        mc,
        i,
        { ...p, type: undefined, gradientTransform: undefined, blend: undefined, color: '#fff' },
        local,
        world,
      );
      lc.setTransform(ctx.getTransform());
      lc.transform(...p.gradientTransform);
      lc.fillStyle = this.#gradient(lc, p);
      const inv = lc.getTransform().inverse();
      const corners = [
        [0, 0],
        [layer.width, 0],
        [0, layer.height],
        [layer.width, layer.height],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(inv));
      const x = Math.min(...corners.map((p) => p.x)),
        y = Math.min(...corners.map((p) => p.y));
      lc.fillRect(
        x,
        y,
        Math.max(...corners.map((p) => p.x)) - x,
        Math.max(...corners.map((p) => p.y)) - y,
      );
      lc.resetTransform();
      lc.globalCompositeOperation = 'destination-in';
      lc.drawImage(mask, 0, 0);
      ctx.save();
      ctx.resetTransform();
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
      return;
    }
    if (p.type) style = this.#gradient(ctx, p);
    if (p.image) {
      const img = this.#image(p.image.source);
      if (!img) return;
      const r = p.image;
      const tile = document.createElement('canvas');
      const transform = ctx.getTransform();
      tile.width = Math.max(
        1,
        Math.ceil(r.width * Math.hypot(transform.a, transform.b) * Math.abs(r.scaleX)),
      );
      tile.height = Math.max(
        1,
        Math.ceil(r.height * Math.hypot(transform.c, transform.d) * Math.abs(r.scaleY)),
      );
      context(tile).drawImage(img, 0, 0, tile.width, tile.height);
      if (r.modulate) {
        const tc = context(tile),
          data = tc.getImageData(0, 0, tile.width, tile.height);
        for (let k = 0; k < data.data.length; k++)
          data.data[k] = data.data[k]! * r.modulate[k % 4]!;
        tc.putImageData(data, 0, 0);
      }
      const pattern = ctx.createPattern(tile, 'repeat')!;
      pattern.setTransform(
        new DOMMatrix()
          .translate(r.x, r.y)
          .rotate(r.rotate)
          .scale((r.scaleX * r.width) / tile.width, (r.scaleY * r.height) / tile.height),
      );
      style = pattern;
    }
    for (const hook of (this.#icon.constructor as CanvasSourceHost).canvasSources ?? []) {
      const source = hook(p, ctx, (frame, width, height) =>
        this.#source(
          frame,
          width,
          height,
          (this.#frame!.tree.nodes[i]!.pointer ?? '/nodes/' + i) +
            '/' +
            (p.key ?? p.kind) +
            '/paint',
        ),
      );
      if (source) {
        style = source;
        break;
      }
    }
    if (!p.color && !p.type && !p.image && typeof style === 'string') {
      this.#unsupported('unregistered paint source', i, 'fill/paint');
      return;
    }
    ctx.fillStyle = style;
    ctx.strokeStyle = style;
    const rule = (p.rule ?? 'nonzero') as CanvasFillRule;
    if (p.kind === 'fill') {
      ctx.fill(local, rule);
      return;
    }
    if (!p.width || p.width <= 0) return;
    ctx.miterLimit = 4;
    let shape = local;
    if (p.scale === 'fixed') {
      shape = new Path2D();
      const ratio = this.pixelRatio;
      const device = mul(this.#viewport, world).map((v) => v / ratio) as Mat;
      shape.addPath(local, matrix(device));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    ctx.lineWidth = p.width!;
    ctx.lineCap = p.cap as CanvasLineCap;
    ctx.lineJoin = p.join as CanvasLineJoin;
    ctx.setLineDash(p.dash ?? []);
    ctx.lineDashOffset = p.dashOffset ?? 0;
    if (p.trim) {
      const t = p.trim,
        fraction = Math.min(1, t.end - t.start);
      if (fraction <= 0) return;
      if (fraction < 1) {
        if (p.scale === 'fixed') {
          this.#unsupported('fixed stroke trim', i, p.key);
          return;
        }
        const len = geometryLength(this.#frame!.nodes[i]!.geometry!, this.#frame!.tree.nodes[i]);
        ctx.setLineDash([fraction * len, (1 - fraction) * len]);
        ctx.lineDashOffset = -((((t.start + t.offset) % 1) + 1) % 1) * len;
      }
    }
    if (p.position && p.position !== 'center') {
      ctx.lineWidth *= 2;
      if (p.position === 'inside') {
        ctx.clip(shape, rule);
        ctx.stroke(shape);
      } else {
        const layer = this.#surface(),
          lc = context(layer);
        lc.setTransform(ctx.getTransform());
        lc.strokeStyle = ctx.strokeStyle;
        lc.lineWidth = ctx.lineWidth;
        lc.lineCap = ctx.lineCap;
        lc.lineJoin = ctx.lineJoin;
        lc.miterLimit = ctx.miterLimit;
        lc.setLineDash(ctx.getLineDash());
        lc.lineDashOffset = ctx.lineDashOffset;
        lc.stroke(shape);
        lc.globalCompositeOperation = 'destination-out';
        lc.fill(shape, rule);
        ctx.resetTransform();
        ctx.drawImage(layer, 0, 0);
      }
    } else ctx.stroke(shape);
  }
}

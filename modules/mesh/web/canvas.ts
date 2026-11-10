import '../../canvas/web/index.ts';
import '../../../packages/web/src/index.ts';
import type { CanvasSourceHost } from '../../canvas/web/sources.ts';
const Icon = customElements.get('anima-icon') as CanvasSourceHost;
type State = {
  images: Map<string, HTMLImageElement>;
  pending: Set<Promise<void>>;
  redraw: () => void;
};
let active: State;
const factory = Icon.renderers.canvas!;
Icon.renderers.canvas = (icon) => {
  const renderer = factory(icon) as import('../../canvas/web/renderer.ts').CanvasRenderer;
  if (!icon.player!.model.doc.requires?.includes('mesh')) return renderer;
  const own: State = { images: new Map(), pending: new Set(), redraw: () => icon.invalidate() };
  const draw = renderer.draw.bind(renderer),
    destroy = renderer.destroy.bind(renderer);
  const ready = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(renderer), 'ready')!.get!;
  Object.defineProperty(renderer, 'ready', {
    get: () => Promise.all([ready.call(renderer), ...own.pending]),
  });
  renderer.draw = (...args) => {
    const before = active;
    active = own;
    try {
      draw(...args);
    } finally {
      active = before;
    }
  };
  renderer.destroy = () => {
    own.redraw = () => {};
    own.images.clear();
    destroy();
  };
  return renderer;
};
(Icon.canvasShapes ??= []).push((ctx, node) => {
  const m = node.mesh;
  if (!m) return false;
  const src = node.geometry!.image!.source;
  let image = active.images.get(src);
  if (!image) {
    image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = src;
    active.images.set(src, image);
    const own = active,
      pending = image
        .decode()
        .then(
          () => own.redraw(),
          () => {},
        )
        .finally(() => own.pending.delete(pending));
    own.pending.add(pending);
  }
  if (!image.complete || !image.naturalWidth) return true;
  ctx.imageSmoothingEnabled = node.geometry!.image!.sampling !== 'nearest';
  const transform = ctx.getTransform();
  for (const tri of m.triangles) {
    const q = tri.map((k) =>
      new DOMPoint(m.points[k * 2]!, m.points[k * 2 + 1]!).matrixTransform(transform),
    );
    const [a, b, c] = tri.map((k) => m.uv.slice(k * 2, k * 2 + 2));
    const u = b![0]! - a![0]!,
      v = b![1]! - a![1]!,
      s = c![0]! - a![0]!,
      t = c![1]! - a![1]!,
      det = u * t - v * s;
    if (!det) continue;
    const [A, B, C] = q,
      x = B!.x - A!.x,
      y = B!.y - A!.y,
      xx = C!.x - A!.x,
      yy = C!.y - A!.y;
    const sx = (x * t - xx * v) / det,
      sy = (y * t - yy * v) / det,
      tx = (xx * u - x * s) / det,
      ty = (yy * u - y * s) / det;
    ctx.save();
    ctx.resetTransform();
    ctx.beginPath();
    // Offset all three edge lines outwards by exactly half a device pixel.
    const area = (B!.x - A!.x) * (C!.y - A!.y) - (B!.y - A!.y) * (C!.x - A!.x);
    if (!area) {
      ctx.restore();
      continue;
    }
    const normals = q.map((p, k) => {
      const n = q[(k + 1) % 3]!,
        dx = n.x - p.x,
        dy = n.y - p.y,
        len = Math.hypot(dx, dy) * Math.sign(area);
      return [dy / len, -dx / len];
    });
    q.forEach((p, k) => {
      const n = normals[(k + 2) % 3]!,
        o = normals[k]!,
        d = 2 * (1 + n[0]! * o[0]! + n[1]! * o[1]!);
      const x = p.x + (n[0]! + o[0]!) / d,
        y = p.y + (n[1]! + o[1]!) / d;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(
      sx,
      sy,
      tx,
      ty,
      A!.x - sx * a![0]! - tx * a![1]!,
      A!.y - sy * a![0]! - ty * a![1]!,
    );
    ctx.drawImage(image, 0, 0, 1, 1);
    ctx.restore();
  }
  return true;
});

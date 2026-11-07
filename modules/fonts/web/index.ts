import '../../../packages/web/src/index.ts';
import type {} from '../../assets/web/index.ts';
import { fonts } from '../core/index.ts';
import { cssFont, type FontStyle } from '../core/css.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import type { Asset, assets } from '../../assets/core/index.ts';
import type { Player } from '../../../packages/core/src/player.ts';
export { cssFont, type FontStyle } from '../core/css.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(fonts);
const controllers = new WeakMap<AnimaIcon, FontController>();
const owners = new WeakMap<Player, AnimaIcon>();
let serial = 0;
const refs = new Map<FontFace, number>();
const external = new WeakSet<FontFace>();
export class FontController {
  private children = new Map<object, FontController>();
  forModel(model: Player['model']): FontController {
    if (model === this.icon.player?.model) return this;
    let child = this.children.get(model);
    if (!child) this.children.set(model, (child = new FontController(this.icon)));
    return child;
  }
  private families = new Map<string, string>();
  private faces = new Set<FontFace>();
  private fallback: string[] = [];
  private versions = new Map<string, number>();
  private epoch = 0;
  revision = 0;
  private fallbackFaces = new Set<FontFace>();
  get generation() {
    return this.epoch;
  }
  private icon: AnimaIcon;
  constructor(icon: AnimaIcon) {
    this.icon = icon;
  }
  cssFont(spec: FontStyle) {
    const root = this.icon.fonts;
    for (const scope of root === this ? [this] : [this, root])
      for (const face of scope.fallbackFaces) scope.retain(face);
    // Replace named assets while preserving authored CSS family lists.
    const family = (spec.family.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,]+/g) ?? [])
      .map((name) => {
        const key = name.trim().replace(/^['"]|['"]$/g, '');
        return this.families.get(key) ?? name.trim();
      })
      .concat(this.fallback, root === this ? [] : root.fallback)
      .join(', ');
    return cssFont({ ...spec, family });
  }
  async ready(spec: FontStyle, text = 'BESbswy') {
    try {
      await document.fonts.load(this.cssFont(spec).font, text);
    } catch {
      this.warn(spec.family);
    }
  }
  async decode(source: ArrayBuffer | string, descriptors: FontFaceDescriptors = {}) {
    if (typeof source === 'string') {
      const resolved = await this.icon.resolveAsset('', { type: 'font', source });
      source = resolved instanceof Blob ? await resolved.arrayBuffer() : resolved;
    }
    return new FontFace(
      'anima-font-' + ++serial,
      typeof source === 'string' ? `url(${JSON.stringify(source)})` : source,
      descriptors,
    ).load();
  }
  async add(face: FontFace, options: { weight?: number | string } = {}) {
    const epoch = this.epoch;
    if (options.weight !== undefined) face.weight = String(options.weight);
    await face.load();
    if (epoch !== this.epoch) return;
    this.retain(face);
    this.fallbackFaces.add(face);
    const family = JSON.stringify(face.family.replace(/^['"]|['"]$/g, ''));
    if (!this.fallback.includes(family)) this.fallback.push(family);
    this.wake();
  }
  async set(
    name: string,
    source: FontFace | ArrayBuffer | string,
    descriptors: FontFaceDescriptors = {},
  ) {
    const epoch = this.epoch;
    const version = (this.versions.get(name) ?? 0) + 1;
    this.versions.set(name, version);
    try {
      const face =
        source instanceof FontFace ? await source.load() : await this.decode(source, descriptors);
      if (epoch !== this.epoch || this.versions.get(name) !== version) return;
      this.retain(face);
      this.families.set(name, JSON.stringify(face.family.replace(/^['"]|['"]$/g, '')));
      await document.fonts.load(
        `${face.style} ${face.weight.split(' ')[0]} 16px ${this.families.get(name)}`,
      );
      this.wake();
    } catch {
      this.warn(name);
    }
  }
  private retain(face: FontFace) {
    if (this.faces.has(face)) return;
    this.faces.add(face);
    if (!refs.has(face)) {
      if (document.fonts.has(face)) external.add(face);
      else document.fonts.add(face);
      refs.set(face, 0);
    }
    refs.set(face, refs.get(face)! + 1);
  }
  private wake() {
    this.revision++;
    if (this.icon.fonts !== this) this.icon.fonts.revision++;
    const p = this.icon.player;
    if (p) {
      for (let i = 0; i < p.model.nodes.length; i++) p.drawVersions[i] = ++p.drawRevision;
      p.onChange?.();
    }
  }
  private warn(name: string) {
    this.icon.dispatchEvent(
      new CustomEvent('anima:warning', {
        detail: [
          {
            code: 'font-load',
            severity: 'warning',
            pointer: '/assets/' + name.replace(/~/g, '~0').replace(/\//g, '~1') + '/source',
            message: 'cannot load font ' + name,
            hint: 'check the font bytes, source and asset policy; CSS fallback is used',
          },
        ],
      }),
    );
  }
  clear(preserveFallback = false) {
    this.revision++;
    this.epoch++;
    for (const child of this.children.values()) child.clear();
    this.children.clear();
    for (const face of this.faces) {
      const count = refs.get(face)! - 1;
      if (count) refs.set(face, count);
      else {
        refs.delete(face);
        if (!external.has(face)) document.fonts.delete(face);
      }
    }
    this.faces.clear();
    this.families.clear();
    if (!preserveFallback) {
      this.fallback = [];
      this.fallbackFaces.clear();
    }
    this.versions.clear();
  }
}
// Separate text/host bundles may import the entry again. Install on the live constructor once.
if (!Object.getOwnPropertyDescriptor(Icon.prototype, 'fonts')) {
  Object.defineProperty(Icon.prototype, 'fonts', {
    get(this: AnimaIcon) {
      let controller = controllers.get(this);
      if (!controller) controllers.set(this, (controller = new FontController(this)));
      return controller;
    },
  });
  const previous = Icon.loadAssets;
  Icon.loadAssets = async (icon, model) => {
    const controller = icon.fonts;
    const generation = controller.generation;
    await previous?.(icon, model);
    if (icon.fonts !== controller || generation !== controller.generation) return;
    const root = model;
    const seen = new Set<object>();
    const load = async (model: Player['model']): Promise<void> => {
      if (seen.has(model)) return;
      seen.add(model);
      const target = model === root ? controller : controller.forModel(model);
      await Promise.all(
        Object.entries(model.doc.assets ?? {}).map(async ([name, asset]) => {
          if (!model.doc.requires?.includes('fonts') || (asset as Asset).type !== 'font') return;
          try {
            const source = await icon.resolveAsset(name, asset as Asset);
            const response = source instanceof Blob ? source : await fetch(source);
            if (response instanceof Response && !response.ok) throw Error('font fetch failed');
            const bytes = await response.arrayBuffer();
            if (icon.fonts === controller && generation === controller.generation)
              await target.set(name, bytes);
          } catch {
            if (icon.fonts === controller && generation === controller.generation)
              await target.set(name, new ArrayBuffer(0));
          }
        }),
      );
      const components = Icon.modules.get('components') as
        import('../../components/core/index.ts').ComponentModule | undefined;
      await Promise.all(
        model.nodes.flatMap((n) => [...(components?.placements.get(n)?.values() ?? [])]).map(load),
      );
    };
    await load(model);
  };
  const previousHook = Icon.eventHook;
  Icon.eventHook = (icon, kind, detail) => {
    if (kind === 'cleanup') {
      controllers.get(icon)?.clear(true);
    } else if (icon.player) owners.set(icon.player, icon);
    previousHook?.(icon, kind, detail);
  };
  fonts.accepts = (face): face is FontFace => face instanceof FontFace;
  fonts.assign = async (api, path, face) => {
    const icon = owners.get(api.player);
    if (!icon || !(face instanceof FontFace)) throw new TypeError('expected a loaded FontFace');
    const handle = api.font(path); // validate the property before allocating a resource
    const id = 'font-' + ++serial;
    await icon.fonts.forModel(api.player.model).set(id, face);
    const module = Icon.modules.get('assets') as typeof assets;
    const records = {
      ...(module.resolvedAssets.get(api.player) ??
        module.resolvedAssets.get(api.player.model) ??
        api.player.model.doc.assets),
    };
    records[id] = { type: 'font', source: '' };
    module.resolvedAssets.set(api.player, records);
    const prior = api.resourceType;
    api.resourceType = (name) => records[name]?.type ?? prior?.(name);
    handle.set(id);
  };
}
declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    readonly fonts: FontController;
  }
}

declare module '../../host/core/api.ts' {
  interface HostData {
    font(path: string): import('../../host/core/api.ts').DataHandle<string> & {
      set(value: FontFace): void | Promise<void>;
    };
  }
}

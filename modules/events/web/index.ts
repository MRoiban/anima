import { eventsMarkup } from '../markup/index.ts';
import { events } from '../core/index.ts';
import type { AnimaEvent } from '../../../packages/core/src/player.ts';
import '../../../packages/web/src/index.ts';
import type {} from '../../assets/web/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';

type Callback = (event: CustomEvent) => void;
declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    volume: number;
    urlPolicy?: (url: URL, target: string, event: AnimaEvent) => boolean;
    on(type: string, callback: Callback): () => void;
    off(type: string, callback: Callback): void;
    unsubscribeAll(): void;
    stop(): void;
  }
}
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(events);
Icon.registerMarkup('events', eventsMarkup);
const subscriptions = new WeakMap<AnimaIcon, Map<string, Set<Callback>>>();
const volumes = new WeakMap<AnimaIcon, number>();
const failedLoads = new WeakSet<AnimaIcon>();
const emit = (icon: AnimaIcon, kind: string, detail: unknown) =>
  icon.dispatchEvent(new CustomEvent('anima:' + kind, { detail }));
Icon.prototype.on = function (type, callback) {
  type = type.startsWith('anima:') ? type : 'anima:' + type;
  let map = subscriptions.get(this);
  if (!map) subscriptions.set(this, (map = new Map()));
  let set = map.get(type);
  if (!set) map.set(type, (set = new Set()));
  set.add(callback);
  this.addEventListener(type, callback as EventListener);
  return () => this.off(type, callback);
};
Icon.prototype.off = function (type, callback) {
  type = type.startsWith('anima:') ? type : 'anima:' + type;
  this.removeEventListener(type, callback as EventListener);
  subscriptions.get(this)?.get(type)?.delete(callback);
};
Icon.prototype.unsubscribeAll = function () {
  for (const [type, callbacks] of subscriptions.get(this) ?? [])
    for (const cb of callbacks) this.off(type, cb);
  subscriptions.delete(this);
};
Icon.prototype.stop = function () {
  this.pause();
  this.reset();
  emit(this, 'stop', null);
};
Object.defineProperty(Icon.prototype, 'volume', {
  get(this: AnimaIcon) {
    return volumes.get(this) ?? 1;
  },
  set(this: AnimaIcon, value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 1)
      throw new RangeError('volume must be in [0,1]');
    volumes.set(this, value);
    const a = audio.get(this);
    if (a) a.gain.gain.value = value;
  },
});

/** HTTP(S) absolute URLs; relative references must stay on the host origin. */
export function eventURL(value: string, base: string): URL | undefined {
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol)) return;
    if (!/^https?:/i.test(value) && url.origin !== new URL(base).origin) return;
    return url;
  } catch {
    return;
  }
}
interface AudioState {
  context: AudioContext;
  gain: GainNode;
  buffers: Map<string, Promise<AudioBuffer>>;
  sources: Set<AudioBufferSourceNode>;
}
const audio = new WeakMap<AnimaIcon, AudioState>();
// Activation is checked when the event is delivered. Pre-gesture events are dropped, never queued.
async function sound(icon: AnimaIcon, event: AnimaEvent): Promise<void> {
  if (!navigator.userActivation?.hasBeenActive) return;
  const model = icon.player?.model;
  let owner = icon.player;
  let scope = '';
  for (const part of event.name.split('.').slice(0, -1)) {
    const child = (
      owner?.nested as { players?: Map<string, NonNullable<AnimaIcon['player']>> } | undefined
    )?.players?.get(part);
    if (!child) break;
    owner = child;
    scope += part + '.';
  }
  const ownerDoc = owner?.model.doc;
  const asset = ownerDoc?.assets?.[event.audio!];
  const assetName = scope + event.audio!;
  if (!asset) return;
  let a = audio.get(icon);
  try {
    if (!a) {
      const context = new AudioContext();
      const gain = context.createGain();
      gain.gain.value = icon.volume;
      gain.connect(context.destination);
      audio.set(icon, (a = { context, gain, buffers: new Map(), sources: new Set() }));
    }
    await a.context.resume();
    let buffer = a.buffers.get(assetName);
    if (!buffer) {
      buffer = (async () => {
        const source = icon.assets ? await icon.assets(assetName, { ...asset }) : asset.source;
        const bytes =
          source instanceof Blob
            ? await source.arrayBuffer()
            : await fetch(
                new URL(
                  source,
                  new URL(icon.getAttribute('src') ?? document.baseURI, document.baseURI),
                ),
              ).then((r) => {
                if (!r.ok) throw Error();
                return r.arrayBuffer();
              });
        return a!.context.decodeAudioData(bytes);
      })();
      a.buffers.set(assetName, buffer);
    }
    const decoded = await buffer;
    if (icon.player?.model !== model || audio.get(icon) !== a || !icon.isConnected) return;
    const source = a.context.createBufferSource();
    source.buffer = decoded;
    const gain = a.context.createGain();
    gain.gain.value = (event.volume ?? 1) * (ownerDoc?.audioVolumes?.[event.audio!] ?? 1);
    source.connect(gain);
    gain.connect(a.gain);
    a.sources.add(source);
    source.onended = () => {
      a!.sources.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  } catch {
    if (audio.get(icon) !== a) return;
    a?.buffers.delete(assetName);
    emit(icon, 'error', [
      {
        code: 'event-audio-load',
        pointer: '/assets/' + event.audio!.replace(/~/g, '~0').replace(/\//g, '~1') + '/source',
        severity: 'error',
        message: 'cannot decode or play audio asset',
        hint: 'check the asset source and browser audio permission',
      },
    ]);
  }
}
function cleanup(icon: AnimaIcon): void {
  const a = audio.get(icon);
  audio.delete(icon);
  if (a) {
    for (const source of a.sources) source.stop();
    void a.context.close();
  }
}
for (const method of ['destroy'] as const) {
  const previous = Icon.prototype[method];
  // Preserve overloads of load and lifecycle methods.
  Object.defineProperty(Icon.prototype, method, {
    value: function (this: AnimaIcon, ...args: unknown[]) {
      cleanup(this);
      if (!failedLoads.delete(this)) this.unsubscribeAll();
      return Reflect.apply(previous, this, args);
    },
  });
}
const previous = Icon.eventHook;
Icon.eventHook = (icon, kind, detail) => {
  previous?.(icon, kind, detail);
  if (kind === 'loaderror') failedLoads.add(icon);
  if (kind === 'cleanup') {
    cleanup(icon);
    return;
  }
  if (kind !== 'event') {
    emit(icon, kind, detail);
    return;
  }
  const event = detail as AnimaEvent;
  if (event.name === '@loop') emit(icon, 'loop', event);
  if (event.url) {
    const url = eventURL(event.url, document.baseURI);
    const target = event.target ?? '_self';
    if (
      url &&
      ['_blank', '_parent', '_self', '_top'].includes(target) &&
      (icon.urlPolicy
        ? icon.urlPolicy(new URL(url.href), target, event) === true
        : icon.getAttribute('url-policy') === 'allow')
    )
      window.open(url.href, target, 'noopener');
  }
  if (event.audio) void sound(icon, event);
};

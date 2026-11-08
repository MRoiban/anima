import '@anima-format/web/components';
import '@anima-format/web/bind';
import '@anima-format/web/paint';
import { compile, formatMarkup, type MarkupDiagnostic } from '@anima-format/markup';
import { type LayerInspect, type TimelineM } from '@anima-format/core';
import { AnimaIcon } from '@anima-format/web';
import {
  diagnosticRange,
  escapeHTML as esc,
  highlight,
  layoutGraph,
  sampleTimeline,
} from './pure.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const source = $<HTMLTextAreaElement>('source');
const code = $('code');
const icon = $<AnimaIcon>('icon');
const sample = $<AnimaIcon>('sample');
type Host = AnimaIcon & {
  speed?: number;
  pause?: () => void;
  play?: () => void;
  reset?: () => void;
  invalidate?: () => void;
  get?: (name: string) => ReturnType<AnimaIcon['get']>;
  playback?: string;
  info?: unknown;
};
const host = (i: AnimaIcon): Host => i;
let chips: AnimaIcon[] = [];
const all = () => [icon, ...chips];
const select = $<HTMLSelectElement>('timeline');
let text = '',
  savedText = '',
  revision = '',
  filename = '',
  writable = false,
  conflict = false;
let compiled = compile('');
let diagnostics: MarkupDiagnostic[] = [];
let jsonView = false,
  paused = false,
  scrubbing = false,
  scrubPlaying = false,
  time = 0,
  speed = 1;
let frame = 0,
  last = 0,
  debounce = 0,
  saveInProgress = false;
let graphLayouts: ReturnType<typeof layoutGraph>[] = [];
let events: string[] = [];

function message(s: string) {
  $('message').textContent = s;
  if (s)
    setTimeout(() => {
      if ($('message').textContent === s) $('message').textContent = '';
    }, 4500);
}
function pressed(id: string, on: boolean) {
  $(id).setAttribute('aria-pressed', String(on));
}
function syncScroll() {
  code.scrollTop = source.scrollTop;
  code.scrollLeft = source.scrollLeft;
}
function paintSource() {
  if (!jsonView) code.innerHTML = highlight(text, diagnostics);
  $('lines').textContent = jsonView
    ? 'compiled · read-only'
    : `AniML · ${text.split('\n').length} lines`;
  syncScroll();
}
function fileState(state?: string) {
  $('saved').textContent =
    state ?? (!writable ? 'read-only example' : text === savedText ? 'saved' : 'unsaved');
  $<HTMLButtonElement>('save').disabled = !writable || conflict || saveInProgress;
  $('reload').hidden = !conflict;
}
function showSource(json: boolean) {
  jsonView = json;
  source.readOnly = json;
  source.setAttribute('aria-label', json ? 'Compiled .ani (read-only)' : 'AniML source');
  source.value = json ? (compiled.text ?? 'No valid build yet.') : text;
  code.hidden = json;
  pressed('animl', !json);
  pressed('ani', json);
  paintSource();
}
function jump(d: MarkupDiagnostic) {
  showSource(false);
  const target =
    d.file && !d.file.endsWith('/' + filename) && d.file !== filename
      ? d.related?.find((r) => r.file?.endsWith('/' + filename) || r.file === filename)
      : d;
  if (!target) return;
  const [a, b] = diagnosticRange(text, target);
  source.focus();
  source.setSelectionRange(a, b);
  source.scrollTop = Math.max(0, ((target.line ?? 1) - 1) * 20 - source.clientHeight / 2);
  syncScroll();
}
function problems(ds: MarkupDiagnostic[]) {
  diagnostics = ds;
  const errors = ds.filter((d) => d.severity === 'error').length;
  $('status').className = `pill ${errors ? 'err' : 'ok'}`;
  $('status').textContent = errors
    ? `${errors} error${errors === 1 ? '' : 's'}`
    : ds.length
      ? `${ds.length} warning${ds.length === 1 ? '' : 's'}`
      : 'valid';
  $('pcount').textContent = ds.length ? `${ds.length} ${errors ? 'errors' : 'warnings'}` : 'none';
  $('tilewrap').classList.toggle('broken', !!errors);
  $('diags').innerHTML = ds.length
    ? ds
        .map(
          (d, i) =>
            `<li><button class="diag ${d.severity === 'warning' ? 'warn' : ''} ${i === 0 ? 'sel' : ''}" data-diag="${i}"><span class="dot"></span><span class="where">${esc(d.file ?? filename)}:${d.line ?? 1}:${d.column ?? 1}</span><span class="msg">${esc(d.message)} <span class="code-id">${esc(d.code)}</span></span>${d.hint ? `<span class="hint">hint: ${esc(d.hint)}</span>` : ''}</button></li>`,
        )
        .join('')
    : '<li class="empty">No problems. Every change is compiled as you type.</li>';
  $('diags')
    .querySelectorAll<HTMLButtonElement>('[data-diag]')
    .forEach(
      (b) =>
        (b.onclick = () => {
          $('diags').querySelector('.sel')?.classList.remove('sel');
          b.classList.add('sel');
          jump(ds[Number(b.dataset.diag)]!);
        }),
    );
  paintSource();
}
function loadIcons() {
  if (!compiled.doc) return;
  for (const i of all()) {
    i.load(compiled.doc);
    if ('speed' in host(i)) host(i).speed = speed;
    if (paused || scrubbing) host(i).pause?.();
  }
}
let compilation = 0;
async function compileEdit() {
  const generation = ++compilation;
  const result = /<import\b/.test(text)
    ? ((await fetch('/api/compile', { method: 'POST', body: text }).then((r) =>
        r.json(),
      )) as ReturnType<typeof compile>)
    : compile(text, { file: filename });
  if (generation !== compilation) return;
  problems(result.diagnostics);
  if (!result.doc) {
    $<HTMLButtonElement>('copy').disabled = !compiled.text;
    return;
  }
  leaveScrub(false);
  compiled = result;
  time = 0;
  events = [];
  $('events').innerHTML = 'events <span class="count">none yet</span>';
  $('buildsize').textContent =
    ` · builds to ${String(result.doc.name)}.ani (${(new TextEncoder().encode(result.text).length / 1024).toFixed(1)} KB)`;
  $('sizes').innerHTML = [16, 24, 48, 'inverse']
    .map(
      (size) =>
        `<figure><span class="chip ${size === 'inverse' ? 'inverse' : ''}" style="width:${size === 'inverse' ? 56 : Number(size) + 8}px;height:${size === 'inverse' ? 56 : Number(size) + 8}px;--size:${size === 'inverse' ? 48 : size}px"><anima-icon aria-hidden="true" tabindex="-1"></anima-icon></span><figcaption>${size}</figcaption></figure>`,
    )
    .join('');
  chips = Array.from($('sizes').querySelectorAll('anima-icon'));
  for (const i of chips)
    i.setAttribute(
      'motion',
      $('motion').getAttribute('aria-pressed') === 'true' ? 'reduce' : 'full',
    );
  loadIcons();
  // load() installs document accessibility: these secondary copies stay decorative.
  for (const i of chips) {
    i.setAttribute('aria-hidden', 'true');
    i.removeAttribute('role');
    i.tabIndex = -1;
  }
  buildInputs();
  buildGraphs();
  select.innerHTML = icon
    .player!.model.timelines.map(
      (t) => `<option value="${esc(t.name)}">${esc(t.name)} · ${t.duration} s</option>`,
    )
    .join('');
  select.disabled = !select.options.length;
  buildTracks();
  update();
  kick();
  fileState();
  $<HTMLButtonElement>('copy').disabled = false;
  if (jsonView) showSource(true);
}
source.addEventListener('scroll', syncScroll);
source.addEventListener('input', () => {
  if (jsonView) return;
  text = source.value;
  fileState();
  paintSource();
  clearTimeout(debounce);
  debounce = window.setTimeout(compileEdit, 150);
});
source.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !jsonView) {
    e.preventDefault();
    const a = source.selectionStart,
      b = source.selectionEnd;
    source.setRangeText('  ', a, b, 'end');
    source.dispatchEvent(new Event('input'));
  }
});

function buildInputs() {
  const inputs = [...icon.player!.model.inputs.values()];
  $('inputcount').textContent = String(inputs.length);
  $('inputs').innerHTML =
    inputs
      .map(
        (i, index) =>
          `<div class="inp"><span class="name">${esc(i.name)}</span><span class="type">${i.type}</span><span class="ctl">${i.type === 'trigger' ? `<button class="fire" data-input="${index}" aria-label="Fire ${esc(i.name)}">Fire</button>` : i.type === 'bool' ? `<button class="tog" role="switch" aria-checked="${!!i.def}" aria-label="${esc(i.name)}" data-input="${index}"></button>` : `<input type="number" step="any" style="width:80px" aria-label="${esc(i.name)}" data-input="${index}" value="${Number(i.def)}" ${Number.isFinite(i.min) ? `min="${i.min}"` : ''} ${Number.isFinite(i.max) ? `max="${i.max}"` : ''}>`}</span></div>`,
      )
      .join('') || '<span class="empty">No inputs in this document.</span>';
  $('inputs')
    .querySelectorAll<HTMLButtonElement | HTMLInputElement>('[data-input]')
    .forEach((control) => {
      const i = inputs[Number(control.dataset.input)]!;
      const act = () => {
        if (scrubbing) return;
        if (i.type === 'number') {
          const v = (control as HTMLInputElement).valueAsNumber;
          if (!Number.isFinite(v)) return;
          for (const el of all()) el.set(i.name, Math.max(i.min, Math.min(i.max, v)));
        } else
          for (const el of all())
            if (i.type === 'trigger') el.fire(i.name);
            else el.toggle(i.name);
        kick();
      };
      if (i.type === 'number') control.onchange = act;
      else control.onclick = act;
    });
}
function buildGraphs() {
  const model = icon.player!.model;
  graphLayouts = model.layers.map(layoutGraph);
  $('layercount').textContent = `${model.layers.length} layers`;
  $('layers').innerHTML =
    model.layers
      .map((layer, i) => {
        const g = graphLayouts[i]!;
        const initial = g.nodes[layer.initial]!;
        return `<div class="layer" data-layer="${esc(layer.name)}"><h3>${esc(layer.name)} <span class="layer-info"></span></h3><svg class="graph" viewBox="0 0 ${g.width} ${g.height}" role="img" aria-describedby="graph-desc-${i}"><title>${esc(layer.name)} state graph</title><defs><marker id="arr-${i}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" fill="context-stroke"/></marker></defs><circle class="entry" cx="10" cy="${initial.y + 14}" r="4"/><path class="ed" d="M14 ${initial.y + 14} H${initial.x - 2}" marker-end="url(#arr-${i})"/>${g.edges
          .map((e) => {
            const raw = model.doc.machine.layers[layer.name].states[layer.states[e.from]!.name].on[
              e.index
            ] as { when: string; blend?: number };
            const label = raw.when + (raw.blend ? ` · ${raw.blend}` : '');
            return `<g data-edge="${e.from}-${e.to}"><path class="ed" d="${e.path}" marker-end="url(#arr-${i})"/><text class="lab" x="${e.x}" y="${e.y}" text-anchor="middle">${esc(label)}</text><title>${esc(layer.states[e.from]!.name)} → ${esc(layer.states[e.to]!.name)}: ${esc(label)}</title></g>`;
          })
          .join(
            '',
          )}${g.nodes.map((n, j) => `<g class="st" data-state="${esc(n.name)}" data-index="${j}"><rect x="${n.x}" y="${n.y}" width="${n.width}" height="28" rx="14"/><text x="${n.x + n.width / 2}" y="${n.y + 18}" text-anchor="middle">${esc(n.name)}</text></g>`).join('')}</svg><p class="sr-only" id="graph-desc-${i}">${g.edges
          .map((e) => {
            const raw = model.doc.machine.layers[layer.name].states[layer.states[e.from]!.name].on[
              e.index
            ] as { when: string };
            return esc(
              `${layer.states[e.from]!.name} to ${layer.states[e.to]!.name} when ${raw.when}`,
            );
          })
          .join(
            '; ',
          )}</p><div class="blend" hidden><span>blend</span><span class="bar2"><i></i></span><span class="percent"></span></div></div>`;
      })
      .join('') || '<p class="empty">No state machine. Select a timeline to scrub.</p>';
}
function updateGraph(state: LayerInspect, index: number) {
  const panel = $('layers').children[index] as HTMLElement;
  if (!panel) return;
  const layer = icon.player!.model.layers[index]!;
  panel.querySelector('.layer-info')!.textContent =
    state.blend !== null
      ? `blending ${state.prev} → ${state.state}${state.locked ? ' · locked' : ''}`
      : state.timeline
        ? `plays ${state.timeline} · ${(state.time ?? 0).toFixed(2)} / ${icon.player!.model.timelines.find((t) => t.name === state.timeline)!.duration.toFixed(2)} s`
        : state.state;
  panel
    .querySelector('svg')!
    .setAttribute(
      'aria-label',
      `${state.layer} layer: ${layer.states.map((s) => s.name + (s.name === state.state ? ' (current)' : '')).join(', ')}${state.blend !== null ? `, blending ${Math.round(state.blend * 100)} percent` : ''}`,
    );
  panel.querySelectorAll<SVGGElement>('[data-state]').forEach((n) => {
    n.classList.toggle('cur', n.dataset.state === state.state);
    n.classList.toggle('prev', n.dataset.state === state.prev);
  });
  const from = layer.states.findIndex((s) => s.name === state.prev),
    to = layer.states.findIndex((s) => s.name === state.state);
  panel
    .querySelectorAll<SVGGElement>('[data-edge]')
    .forEach((n) =>
      n
        .querySelectorAll('.ed,.lab')
        .forEach((x) => x.classList.toggle('live', n.dataset.edge === `${from}-${to}`)),
    );
  const blend = panel.querySelector<HTMLElement>('.blend')!;
  blend.hidden = state.blend === null;
  blend.style.display = state.blend === null ? 'none' : 'flex';
  blend.querySelector('i')!.style.width = `${(state.blend ?? 0) * 100}%`;
  blend.querySelector('.percent')!.textContent = `${Math.round((state.blend ?? 0) * 100)} %`;
}
function timeline(): TimelineM | undefined {
  return icon.player?.model.timelines.find((t) => t.name === select.value);
}
function buildTracks() {
  const t = timeline();
  if (!t) {
    $('tracks').innerHTML = '<p class="empty">No timelines.</p>';
    return;
  }
  const pct = (s: number) => (s / t.duration) * 100;
  const ticks = Array.from(
    // The epsilon keeps 1.4 / 0.1 (13.999…) from dropping the last tick.
    { length: Math.min(1000, Math.floor(t.duration / 0.1 + 1e-9)) + 1 },
    (_, i) => i * 0.1,
  );
  let html = `<div class="ruler"><div></div><div class="ticks" style="background-size:${10 / t.duration}% 6px">${ticks
    .filter((_, i) => i % 2 === 0)
    .map((x) => `<span style="left:${pct(x)}%">${Number(x.toFixed(1))}</span>`)
    .join('')}</div><div></div></div>`;
  html += t.tracks
    .map((tr, i) => {
      const raw = icon.player!.model.doc.timelines[t.name].tracks[tr.addr] as [
        number,
        unknown,
        string?,
      ][];
      return `<div class="tr ${i === 0 ? 'sel' : ''}"><div class="tname" title="${esc(tr.addr)}">${esc(tr.addr)}</div><div class="lane"><span class="seg-line" style="left:${pct(tr.times[0]!)}%;width:${pct(tr.times.at(-1)! - tr.times[0]!)}%"></span>${tr.times.map((k, j) => `<span class="kf ${raw[j]?.[2] === 'hold' ? 'hold' : ''}" style="left:${pct(k)}%" title="${k} s"></span>`).join('')}</div><div class="val" data-value="${esc(tr.addr)}"></div></div>`;
    })
    .join('');
  html +=
    '<div class="playhead" id="ph"></div><input id="scrub" type="range" min="0" step="0.001" aria-label="Timeline playhead">';
  $('tracks').innerHTML = html;
  const slider = $<HTMLInputElement>('scrub');
  slider.max = String(t.duration);
  slider.value = String(time);
  slider.oninput = () => scrubTo(Number(slider.value));
  slider.onkeydown = (e) => {
    if (e.key === 'Escape') leaveScrub();
  };
  placePlayhead();
}
function placePlayhead() {
  const t = timeline(),
    lane = $('tracks').querySelector<HTMLElement>('.lane');
  if (t && lane && $('ph'))
    $('ph').style.left = `${lane.offsetLeft + lane.offsetWidth * (time / t.duration)}px`;
}
function scrubTo(t: number) {
  const tl = timeline();
  if (!tl || !icon.player) return;
  time = Math.max(0, Math.min(tl.duration, t));
  scrubbing = true;
  for (const i of all()) host(i).pause?.();
  icon.hidden = true;
  sample.hidden = false;
  sample.load(sampleTimeline(icon.player.model, tl, time, icon.player));
  host(sample).pause?.();
  // Sampling has no pointer actions; it remains a named image for assistive technology.
  sample.setAttribute('role', 'img');
  sample.setAttribute(
    'aria-label',
    `${icon.player.model.doc.title ?? icon.player.model.doc.name} at ${time.toFixed(3)} seconds`,
  );
  sample.tabIndex = -1;
  $('mode').textContent = 'scrubbing — inputs paused';
  $('inputs')
    .querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input')
    .forEach((b) => (b.disabled = true));
  update();
}
function leaveScrub(resume = true) {
  scrubbing = false;
  scrubPlaying = false;
  icon.hidden = false;
  sample.hidden = true;
  $('mode').textContent = 'live — follows the state machine';
  $('inputs')
    .querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input')
    .forEach((b) => (b.disabled = false));
  if (resume && !paused) for (const i of all()) host(i).play?.();
  if (resume) {
    update();
    kick();
  }
}
function update() {
  const p = icon.player;
  if (!p) return;
  const states = p.inspect();
  states.filter((s) => !s.layer.includes('/')).forEach(updateGraph);
  let instances = document.getElementById('instance-states');
  if (!instances) {
    instances = document.createElement('p');
    instances.id = 'instance-states';
    $('layers').after(instances);
  }
  instances.textContent = states
    .filter((s) => s.layer.includes('/'))
    .map((s) => `${s.layer}: ${s.state}`)
    .join(' · ');
  if (!scrubbing) {
    const playing = states.find(
      (s) => s.timeline && s.time !== null && p.model.timelines.find((t) => t.name === s.timeline),
    );
    if (playing && playing.timeline !== select.value) {
      select.value = playing.timeline!;
      buildTracks();
    }
    const chosen = states.find((s) => s.timeline === select.value);
    if (chosen) time = chosen.time ?? time;
  }
  $('time').textContent = `${time.toFixed(3)} s`;
  const slider = $<HTMLInputElement>('scrub');
  if (slider) slider.value = String(time);
  placePlayhead();
  const vals = scrubbing ? sample.values() : icon.values();
  $('tracks')
    .querySelectorAll<HTMLElement>('[data-value]')
    .forEach((el) => {
      const v = vals[el.dataset.value!];
      el.textContent = typeof v === 'number' ? Number(v.toFixed(3)).toString() : String(v ?? '—');
    });
  const inputs = [...p.model.inputs.values()];
  $('inputs')
    .querySelectorAll<HTMLElement>('[data-input]')
    .forEach((el) => {
      const i = inputs[Number(el.dataset.input)]!;
      const v = host(icon).get?.(i.name) ?? p.get(i.name);
      if (i.type === 'bool') el.setAttribute('aria-checked', String(!!v));
      if (i.type === 'number' && document.activeElement !== el)
        (el as HTMLInputElement).value = String(v);
    });
  const liveControls =
    typeof host(icon).pause === 'function' && typeof host(icon).play === 'function';
  $<HTMLButtonElement>('play').disabled = !scrubbing && !liveControls;
  for (const id of ['normal', 'slow']) {
    $<HTMLButtonElement>(id).disabled = !('speed' in host(icon));
    $(id).title = 'speed' in host(icon) ? '' : 'Playback rate requires the web host API';
  }
  $('play').setAttribute('aria-label', (scrubbing ? !scrubPlaying : paused) ? 'Play' : 'Pause');
  $('play').textContent = (scrubbing ? !scrubPlaying : paused) ? '▶' : 'Ⅱ';
}
function kick() {
  if (!frame) {
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }
}
function tick(now: number) {
  frame = 0;
  if (scrubbing && scrubPlaying) {
    const next = time + ((now - last) / 1000) * speed;
    scrubTo(next);
    if (next >= (timeline()?.duration ?? 0)) scrubPlaying = false;
  }
  last = now;
  update();
  if (
    !document.hidden &&
    ((scrubbing && scrubPlaying) || (!scrubbing && !paused && icon.player?.busy))
  )
    frame = requestAnimationFrame(tick);
}
for (const type of [
  'pointermove',
  'pointerdown',
  'pointerup',
  'pointerleave',
  'keydown',
  'keyup',
  'anima:state',
  'anima:load',
])
  icon.addEventListener(type, () => kick());
icon.addEventListener('anima:event', (e) => {
  const event = (e as CustomEvent<{ name: string; time: number }>).detail;
  events.push(`${event.name} · ${event.time.toFixed(2)} s`);
  events = events.slice(-6);
  $('events').innerHTML =
    'events ' + events.map((s) => `<span class="ev">${esc(s)}</span>`).join('');
  kick();
});
select.onchange = () => {
  time = 0;
  buildTracks();
  scrubTo(0);
};
$('tracks').addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).id === 'scrub') return;
  if (!(e.target as HTMLElement).closest('.lane,.ticks')) return;
  const tracks = $('tracks');
  const lane = tracks.querySelector<HTMLElement>('.lane');
  if (!lane) return;
  tracks.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => {
    const r = lane.getBoundingClientRect();
    scrubTo(((ev.clientX - r.left) / r.width) * (timeline()?.duration ?? 0));
  };
  move(e);
  const end = () => {
    tracks.removeEventListener('pointermove', move);
    tracks.removeEventListener('pointerup', end);
    tracks.removeEventListener('pointercancel', end);
  };
  tracks.addEventListener('pointermove', move);
  tracks.addEventListener('pointerup', end);
  tracks.addEventListener('pointercancel', end);
});
$('mode').onclick = () => {
  if (scrubbing) leaveScrub();
};
$('play').onclick = () => {
  if (scrubbing) {
    scrubPlaying = !scrubPlaying;
    if (scrubPlaying && time >= (timeline()?.duration ?? 0)) scrubTo(0);
  } else {
    paused = !paused;
    for (const i of all())
      if (paused) host(i).pause?.();
      else host(i).play?.();
  }
  update();
  kick();
};
$('step').onclick = () => {
  scrubPlaying = false;
  scrubTo(time + 1 / 60);
};
$('reset').onclick = () => {
  leaveScrub(false);
  time = 0;
  for (const i of all())
    if (host(i).reset) host(i).reset!();
    else if (compiled.doc) i.load(compiled.doc);
  if (paused) for (const i of all()) host(i).pause?.();
  update();
  kick();
};
for (const [id, on] of [
  ['grid', true],
  ['bounds', false],
] as const)
  $(id).onclick = () => {
    const active = $(id).getAttribute('aria-pressed') !== 'true';
    pressed(id, active);
    if (on) document.querySelector('.tile')!.classList.toggle('nogrid', !active);
    else (document.querySelector('.ghost') as HTMLElement).hidden = !active;
  };
$('motion').onclick = () => {
  const reduced = $('motion').getAttribute('aria-pressed') !== 'true';
  pressed('motion', reduced);
  for (const i of [...all(), sample]) i.setAttribute('motion', reduced ? 'reduce' : 'full');
  loadIcons();
  if (scrubbing) scrubTo(time);
  update();
  kick();
};
for (const [id, rate] of [
  ['normal', 1],
  ['slow', 0.25],
] as const)
  $(id).onclick = () => {
    speed = rate;
    for (const i of all()) if ('speed' in host(i)) host(i).speed = rate;
    pressed('normal', rate === 1);
    pressed('slow', rate !== 1);
  };
function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  pressed('theme', dark);
}
const themeQuery = matchMedia('(prefers-color-scheme: dark)');
pressed('theme', themeQuery.matches);
themeQuery.addEventListener('change', (e) => {
  if (!document.documentElement.dataset.theme) pressed('theme', e.matches);
});
$('theme').onclick = () =>
  applyTheme(
    document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme !== 'dark'
      : !matchMedia('(prefers-color-scheme: dark)').matches,
  );
$('animl').onclick = () => showSource(false);
$('ani').onclick = () => showSource(true);
$('format').onclick = () => {
  const r = formatMarkup(text);
  if (!r.text) {
    problems(r.diagnostics);
    message('Fix the markup syntax before formatting.');
    return;
  }
  text = r.text;
  showSource(false);
  compileEdit();
  fileState();
};
$('copy').onclick = async () => {
  try {
    if (compiled.text) {
      await navigator.clipboard.writeText(compiled.text);
      message('Copied .ani');
    }
  } catch {
    message('Clipboard unavailable. Select .ani and copy its text.');
  }
};
async function save() {
  if (!writable || conflict || saveInProgress) return;
  const saving = text;
  saveInProgress = true;
  fileState('saving…');
  try {
    const response = await fetch('/api/file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: saving, revision }),
    });
    const data = (await response.json()) as { revision: string; message?: string };
    if (!response.ok) {
      if (response.status === 409) conflict = true;
      throw new Error(data.message ?? 'Save failed');
    }
    revision = data.revision;
    savedText = saving;
  } catch (e) {
    message((e as Error).message);
  } finally {
    saveInProgress = false;
    fileState();
  }
}
$('save').onclick = save;
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    void save();
  }
  if (e.shiftKey && e.altKey && e.code === 'KeyF') {
    e.preventDefault();
    $('format').click();
  }
});
interface FileData {
  source: string;
  revision: string;
  writable: boolean;
  name: string;
}
async function fetchFile(): Promise<FileData> {
  const r = await fetch('/api/file');
  if (!r.ok) throw new Error('Cannot read the opened file');
  return r.json();
}
async function openFile() {
  const d = await fetchFile();
  text = savedText = d.source;
  revision = d.revision;
  filename = d.name;
  writable = d.writable;
  conflict = false;
  $('filename').textContent = filename;
  showSource(false);
  compileEdit();
  fileState();
}
$('reload').onclick = async () => {
  // A reload discards the draft only after an explicit browser confirmation when it differs.
  if (text !== savedText && !confirm('Reload the file from disk and discard your unsaved edits?'))
    return;
  try {
    await openFile();
  } catch (e) {
    message((e as Error).message);
  }
};
void openFile().catch((e) => message((e as Error).message));
window.setInterval(async () => {
  if (document.hidden || saveInProgress) return;
  // A save or reload that completes while this poll is in flight makes its answer stale.
  const asked = revision;
  try {
    const d = await fetchFile();
    if (d.revision !== revision && revision === asked && !saveInProgress) {
      conflict = true;
      fileState();
    }
  } catch {
    message('File connection lost. Your draft is still in the editor.');
  }
}, 1000);
addEventListener('resize', placePlayhead);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) kick();
});

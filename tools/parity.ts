// Generates the parity views from docs/parity/inventory.json (the source of truth):
//   docs/parity/INVENTORY.md  what Rive can do, by category, with sources
//   docs/parity/MATRIX.md     how each capability maps to Anima, by phase, plus "Maybe / later"
//   docs/parity/matrix.json   the mapping alone, for tools
// `node tools/parity.ts` writes them; `--check` fails if they are stale.
import { readFileSync, writeFileSync } from 'node:fs';

export interface Row {
  id: string;
  category: string;
  capability: string;
  what: string;
  rive: { types: string[]; properties: string[]; api: string[] };
  kind: 'file' | 'runtime' | 'api' | 'tooling';
  sources: string[];
  aliases?: string[];
  anima: {
    construct: string;
    module: string;
    status: Status;
    reason?: string;
    test: string;
    phase: string;
  };
}

export const STATUSES = [
  'done',
  "spec'd",
  'planned',
  'deferred',
  'maybe-later',
  'wont-do',
] as const;
export type Status = (typeof STATUSES)[number];

/** Category order follows the inventory brief. */
export const CATEGORIES: [string, string][] = [
  ['drawing-paint', 'Drawing and paint'],
  ['transforms', 'Transforms and draw order'],
  ['animation', 'Animation'],
  ['state-machine', 'State machines'],
  ['input', 'Listeners and input'],
  ['data', 'Data: view models, binding, converters'],
  ['events', 'Events'],
  ['components', 'Components'],
  ['text', 'Text'],
  ['layout', 'Layout'],
  ['rigging', 'Rigging'],
  ['scripting', 'Scripting'],
  ['gpu', 'GPU'],
  ['assets', 'Assets'],
  ['a11y', 'Accessibility'],
  ['host-api', 'Host runtime API'],
  ['platforms', 'Platforms'],
  ['tooling', 'Tooling'],
];

export const PHASES: [string, string][] = [
  ['P0', 'Done: format 0.1, core, CLI, `<anima-icon>` (M0–M4)'],
  ['P1', 'Done: AniML, the authoring markup'],
  ['P2', 'Done: M5, Glyphy export, more glyphs, the head-to-head test'],
  ['P3', 'Done: the playground/inspector and the web host API'],
  ['P3b', 'Done: the a11y module, authoring/drawing tools and headless CLI extras'],
  ['P3c', 'Size round (≥ 5 % off the runtime sum) and P3b carry-overs'],
  ['P4a', 'Done: paint and composite on the module system and the draw layer'],
  ['P4b', 'Done: motion — eases, typed tracks, timeline control, mixing, host timeline API'],
  [
    'P4c',
    'Done: interaction — machine (blends, actions, on-change), input (pointer, keys, gamepad, scroll, drag), focus',
  ],
  [
    'P4d',
    'Done: events — payloads, URL events with a host policy, audio, lifecycle events, expression actions',
  ],
  [
    'P4e',
    'Done: data — view models, $ paths, binding modes, converters, host data API, paint leftovers',
  ],
  ['P4', 'Interaction, paint, events and data binding'],
  ['P5', 'Done: components, bindings, assets, images, n-slice and feathering'],
  [
    'P5b',
    'Done: lists, assets, host editing, typed data guards, live keyframes and component controls',
  ],
  ['Pc', 'Done: the canvas backend (minimal), brought forward from P10'],
  [
    'P6',
    'Done: text on the browser — layout, fonts (FontFace), effects, bidi, DOM-backed input, CLI text',
  ],
  [
    'P7',
    'Minimal layout (hug, padding, min/max, fixed, row/column stacks), host fit, P6 text carry-overs',
  ],
  ['P8', 'Rigging (heavy), plus the a11y tree-bounds carry-over'],
  ['P9', "Scripting — won't do (owner triage, 2026-11-07)"],
  ['P10', 'GPU effects and WebGL/WebGPU — maybe later (owner triage, 2026-11-07)'],
];

/** Phases whose rows are all done. */
export const FINISHED = [
  'P0',
  'P1',
  'P2',
  'P3',
  'P3b',
  'P3c',
  'P4a',
  'P4b',
  'P4c',
  'P4d',
  'P4e',
  'P5',
  'P5b',
  'P6',
  'P7',
  'Pc',
];

/** The phase being worked on: its rows may be done before the phase is finished. */
export const IN_PROGRESS = ['P8'];

const ROOT = new URL('../docs/parity/', import.meta.url);

export function readInventory(): Row[] {
  return JSON.parse(readFileSync(new URL('inventory.json', ROOT), 'utf8')) as Row[];
}

/** Problems with the inventory (empty when it is well-formed). */
export function lint(rows: Row[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const cats = new Set(CATEGORIES.map((c) => c[0]));
  const phases = new Set([...PHASES.map((p) => p[0]), 'later', '—']);
  for (const r of rows) {
    if (ids.has(r.id)) out.push(`${r.id}: duplicate id`);
    ids.add(r.id);
    if (!r.id.startsWith(r.category + '.'))
      out.push(`${r.id}: id does not start with its category`);
    if (!cats.has(r.category)) out.push(`${r.id}: unknown category ${r.category}`);
    if (!r.sources.length) out.push(`${r.id}: no sources`);
    if (!r.what.trim()) out.push(`${r.id}: no description`);
    if (!STATUSES.includes(r.anima.status)) out.push(`${r.id}: unknown status ${r.anima.status}`);
    if (['deferred', 'maybe-later', 'wont-do'].includes(r.anima.status) && !r.anima.reason)
      out.push(`${r.id}: ${r.anima.status} needs a reason`);
    if (!phases.has(r.anima.phase)) out.push(`${r.id}: unknown phase ${r.anima.phase}`);
    if ((r.anima.status === 'maybe-later') !== (r.anima.phase === 'later'))
      out.push(`${r.id}: maybe-later rows (only) go in phase "later"`);
    // Tickets close individual rows of the phase in progress before the phase itself finishes.
    if (
      (r.anima.status === 'done') !== FINISHED.includes(r.anima.phase) &&
      !(IN_PROGRESS.includes(r.anima.phase) && r.anima.status === 'done')
    )
      out.push(
        `${r.id}: finished phases require done; done rows elsewhere only in ${IN_PROGRESS.join(', ')}`,
      );
  }
  return out;
}

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = (xs: string[]) => xs.map((x) => '`' + x + '`').join(', ');
const count = (rows: Row[], f: (r: Row) => boolean) => rows.filter(f).length;

export function inventoryMd(rows: Row[]): string {
  const lines = [
    '# Rive capability inventory',
    '',
    'Generated by `node tools/parity.ts` from [`inventory.json`](inventory.json); do not edit by hand.',
    'Every row is a distinct capability, described in our own words, with the Rive mechanism (type, property',
    'and API names are cited as facts) and where it was found. How each maps to Anima is in',
    '[`MATRIX.md`](MATRIX.md); method and sources are in [`README.md`](README.md).',
    '',
    '| Category | Capabilities |',
    '|---|---:|',
    ...CATEGORIES.map(
      ([c, title]) => `| [${title}](#${c}) | ${count(rows, (r) => r.category === c)} |`,
    ),
    `| **Total** | **${rows.length}** |`,
    '',
  ];
  for (const [c, title] of CATEGORIES) {
    const rs = rows.filter((r) => r.category === c);
    lines.push(
      `## ${title} <a id="${c}"></a>`,
      '',
      '| Id | Capability | What it does | Rive mechanism | Kind | Sources |',
      '|---|---|---|---|---|---|',
    );
    for (const r of rs) {
      const mech = [code(r.rive.types), code(r.rive.properties), code(r.rive.api)]
        .filter(Boolean)
        .join('; ');
      const id = r.aliases?.length
        ? `\`${r.id}\` (also ${r.aliases.map((a) => '`' + a + '`').join(', ')})`
        : `\`${r.id}\``;
      lines.push(
        `| ${id} | ${esc(r.capability)} | ${esc(r.what)} | ${esc(mech)} | ${r.kind} | ${esc(r.sources.join('; '))} |`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function matrixJson(rows: Row[]): string {
  const m = rows.map((r) => ({
    id: r.id,
    category: r.category,
    capability: r.capability,
    ...r.anima,
  }));
  return JSON.stringify(m, null, 1) + '\n';
}

export function matrixMd(rows: Row[]): string {
  const st = (rs: Row[], s: Status) => count(rs, (r) => r.anima.status === s);
  const lines = [
    '# Rive → Anima capability matrix',
    '',
    'Generated by `node tools/parity.ts` from [`inventory.json`](inventory.json); do not edit by hand.',
    'Each row maps a capability from [`INVENTORY.md`](INVENTORY.md) to its Anima construct (an existing',
    '`.ani`/AniML construct, or `new: …` for a proposal), the runtime module that will carry it, its status,',
    'its phase, and the test that proves it. Phases, modules and size budgets are explained in',
    '[`README.md`](README.md).',
    '',
    "Statuses: **done** (specified and implemented) · **spec'd** (specified or reserved, not implemented) ·",
    '**planned** (scheduled in a phase) · **deferred** (planned, cannot be designed yet) · **maybe-later**',
    '(inventoried, kept possible, not scheduled) · **wont-do** (conflicts with the project guardrails, or out of',
    "scope by the owner's triage of 2026-11-07).",
    '',
    '## Summary',
    '',
    "| Category | Total | done | spec'd | planned | deferred | maybe-later | wont-do |",
    '|---|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const [c, title] of CATEGORIES) {
    const rs = rows.filter((r) => r.category === c);
    lines.push(`| ${title} | ${rs.length} | ${STATUSES.map((s) => st(rs, s) || '').join(' | ')} |`);
  }
  lines.push(
    `| **Total** | **${rows.length}** | ${STATUSES.map((s) => `**${st(rows, s)}**`).join(' | ')} |`,
    '',
  );
  // Progress is measured against the in-scope rows (owner, 2026-11-07): everything except
  // maybe-later and won't-do. The full-matrix figure stays next to it.
  const done = st(rows, 'done');
  const inScope = count(rows, (r) => !['maybe-later', 'wont-do'].includes(r.anima.status));
  lines.push(
    `**Progress:** ${done} of ${inScope} in-scope capabilities done (${Math.round((100 * done) / inScope)} %); ` +
      `${done} of ${rows.length} in the full matrix (${Math.round((100 * done) / rows.length)} %).`,
    '',
  );
  lines.push('| Phase | Rows |', '|---|---:|');
  for (const [p, title] of PHASES)
    lines.push(
      `| [${p}](#${p.toLowerCase()}) — ${title} | ${count(rows, (r) => r.anima.phase === p)} |`,
    );
  lines.push(
    `| [Maybe / later](#maybe-later) | ${count(rows, (r) => r.anima.phase === 'later')} |`,
    `| [Won't do](#wont-do) | ${count(rows, (r) => r.anima.status === 'wont-do')} |`,
    '',
  );
  const table = (rs: Row[], withReason = false) => {
    lines.push(
      `| Id | Capability | Anima construct | Module | Status | Test${withReason ? ' | Reason' : ''} |`,
      `|---|---|---|---|---|---|${withReason ? '---|' : ''}`,
    );
    for (const r of rs)
      lines.push(
        `| \`${r.id}\` | ${esc(r.capability)} | ${esc(r.anima.construct)} | ${r.anima.module} | ${r.anima.status} | ${esc(r.anima.test)}${withReason ? ` | ${esc(r.anima.reason ?? '')}` : ''} |`,
      );
    lines.push('');
  };
  for (const [p, title] of PHASES) {
    lines.push(`## ${p} — ${title} <a id="${p.toLowerCase()}"></a>`, '');
    const rs = rows.filter((r) => r.anima.phase === p);
    for (const [c, ctitle] of CATEGORIES) {
      const cs = rs.filter((r) => r.category === c);
      if (!cs.length) continue;
      lines.push(`### ${ctitle}`, '');
      table(
        cs,
        cs.some((r) => r.anima.reason),
      );
    }
  }
  lines.push(
    '## Maybe / later <a id="maybe-later"></a>',
    '',
    'Fully inventoried and kept possible by a portable spec, but not scheduled in the main phases.',
    '',
  );
  for (const [c, ctitle] of CATEGORIES) {
    const cs = rows.filter((r) => r.anima.phase === 'later' && r.category === c);
    if (!cs.length) continue;
    lines.push(`### ${ctitle}`, '');
    table(cs, true);
  }
  lines.push(
    '## Won\'t do <a id="wont-do"></a>',
    '',
    'Only capabilities that conflict with the project guardrails.',
    '',
  );
  table(
    rows.filter((r) => r.anima.status === 'wont-do'),
    true,
  );
  return lines.join('\n');
}

export function outputs(rows: Row[]): Record<string, string> {
  return {
    'INVENTORY.md': inventoryMd(rows),
    'MATRIX.md': matrixMd(rows),
    'matrix.json': matrixJson(rows),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = readInventory();
  const problems = lint(rows);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const check = process.argv.includes('--check');
  let stale = false;
  for (const [name, text] of Object.entries(outputs(rows))) {
    const url = new URL(name, ROOT);
    if (check) stale ||= readFileSync(url, 'utf8') !== text;
    else writeFileSync(url, text);
  }
  if (stale) {
    console.error('docs/parity is stale: run node tools/parity.ts');
    process.exit(1);
  }
  console.log(`${rows.length} capabilities${check ? ', views up to date' : ', views written'}`);
}

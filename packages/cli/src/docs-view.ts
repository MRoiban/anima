import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import '@anima-format/core/all';
import { ELEMENTS, NODE_TYPES } from '@anima-format/core';
import type { IO } from './cli.ts';
import { distance } from './schema-view.ts';

const ROOT = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');
const compact = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/^[0-9]+(?:\.[0-9]+)*[.\s-]*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

type Heading = { level: number; title: string; slug: string; at: number };

function headings(source: string, levels = [2, 3]): Heading[] {
  return [...source.matchAll(/^(#{2,6}) (.+)$/gm)]
    .map((match) => ({
      level: match[1]!.length,
      title: match[2]!,
      slug: slug(match[2]!),
      at: match.index!,
    }))
    .filter((entry) => levels.includes(entry.level));
}

function section(source: string, entry: Heading, entries = headings(source)): string {
  const next = entries.find(
    (candidate) => candidate.at > entry.at && candidate.level <= entry.level,
  );
  return source.slice(entry.at, next?.at ?? source.length).trim();
}

function nearest(word: string, candidates: readonly string[]): string | undefined {
  const key = compact(word);
  const first = [...new Set(candidates)]
    .map((candidate) => ({ candidate, d: distance(key, compact(candidate)) }))
    .sort((a, b) => a.d - b.d || a.candidate.localeCompare(b.candidate))[0];
  return first && first.d <= Math.max(2, Math.floor(key.length / 3)) ? first.candidate : undefined;
}

function moduleDocs() {
  return new Map(
    readdirSync(resolve(ROOT, 'modules'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => [
        entry.name,
        ['AUTHORING.md', 'SPEC.md']
          .map((file) => 'modules/' + entry.name + '/' + file)
          .filter((file) => existsSync(resolve(ROOT, file))),
      ]),
  );
}

type ParityRow = {
  id: string;
  capability?: string;
  what?: string;
  anima?: { module?: string; status?: string };
};

function parityRows(): ParityRow[] {
  return JSON.parse(read('docs/parity/inventory.json')) as ParityRow[];
}

function resolveHeadingForWord(source: string, word: string): Heading | undefined {
  const entries = headings(source);
  const key = compact(word);
  const bySlug = entries.find(
    (entry) => compact(entry.slug) === key || compact(entry.title) === key,
  );
  if (bySlug) return bySlug;

  const lower = source.toLowerCase();
  const terms = [word, word.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())];
  let at = -1;
  for (const term of terms) {
    const index = lower.indexOf(term.toLowerCase());
    if (index >= 0 && (at < 0 || index < at)) at = index;
  }
  if (at < 0) return undefined;
  return entries.filter((entry) => entry.at <= at).at(-1);
}

type Resolved =
  | { kind: 'authoring'; topic: string }
  | { kind: 'spec'; topic: string }
  | { kind: 'markup'; topic: string }
  | { kind: 'guide-section'; topic: string; heading: Heading }
  | { kind: 'spec-section'; topic: string; heading: Heading }
  | { kind: 'module'; topic: string };

function resolver() {
  const guide = read('docs/AUTHORING.md') + '\n\n' + read('packages/cli/src/font/README.md');
  const spec = read('spec/SPEC.md');
  const modules = moduleDocs();
  const guideHeadings = headings(guide);
  const specHeadings = headings(spec);
  const moduleNames = [...modules.keys()];
  const aliases: Record<string, string> = {
    constraint: 'rig',
    constraints: 'rig',
    semantic: 'a11y',
    semantics: 'a11y',
    accessibility: 'a11y',
    a11y: 'a11y',
  };

  const canonicalModule = (word: string) =>
    moduleNames.find((name) => compact(name) === compact(word));

  const resolve = (word: string): Resolved | undefined => {
    if (word === 'authoring') return { kind: 'authoring', topic: 'authoring' };
    if (word === 'spec') return { kind: 'spec', topic: 'spec' };
    if (word === 'markup') return { kind: 'markup', topic: 'markup' };

    const alias = aliases[word] ?? aliases[compact(word)];
    if (alias && alias !== word) return resolve(alias);

    const module = canonicalModule(word);
    if (module) return { kind: 'module', topic: module };

    const guideHeading = guideHeadings.find(
      (entry) => compact(entry.slug) === compact(word) || compact(entry.title) === compact(word),
    );
    if (guideHeading)
      return { kind: 'guide-section', topic: guideHeading.slug, heading: guideHeading };

    const specHeading = specHeadings.find(
      (entry) => compact(entry.slug) === compact(word) || compact(entry.title) === compact(word),
    );
    if (specHeading) return { kind: 'spec-section', topic: specHeading.slug, heading: specHeading };

    const row = parityRows().find((candidate) => compact(candidate.id) === compact(word));
    if (row) {
      const suffix = row.id.split('.').at(-1)!;
      const suffixResolved = resolve(suffix);
      if (suffixResolved) return suffixResolved;
      if (row.anima?.module) {
        const moduleResolved = resolve(row.anima.module);
        if (moduleResolved) return moduleResolved;
      }
    }

    const element = Object.entries(ELEMENTS).find(
      ([name, form]) =>
        compact(name) === compact(word) ||
        (form.values?.kind && compact(form.values.kind) === compact(word)),
    );
    if (element) {
      const heading = resolveHeadingForWord(spec, element[0]) ?? resolveHeadingForWord(spec, word);
      if (heading) return { kind: 'spec-section', topic: heading.slug, heading };
      const feature = element[1].shape.feature;
      if (feature) {
        const featureResolved = resolve(String(feature).split('|')[0]!);
        if (featureResolved) return featureResolved;
      }
    }

    if ((NODE_TYPES as readonly string[]).some((name) => compact(name) === compact(word))) {
      const heading = resolveHeadingForWord(spec, word);
      if (heading) return { kind: 'spec-section', topic: heading.slug, heading };
    }

    const heading = resolveHeadingForWord(spec, word);
    if (heading) return { kind: 'spec-section', topic: heading.slug, heading };
    return undefined;
  };

  const candidates = [
    'authoring',
    'spec',
    'markup',
    ...guideHeadings.map((entry) => entry.slug),
    ...specHeadings.map((entry) => entry.slug),
    ...moduleNames,
    ...Object.keys(aliases),
    ...Object.keys(ELEMENTS),
    ...Object.values(ELEMENTS)
      .map((form) => form.values?.kind)
      .filter((value): value is string => !!value),
    ...NODE_TYPES,
    ...parityRows().map((row) => row.id),
  ];

  return { guide, spec, modules, guideHeadings, specHeadings, resolve, candidates };
}

function moduleText(topic: string, spec: string, modules: Map<string, string[]>): string {
  const specEntries = headings(spec, [2]);
  const chapter = specEntries.find((entry) => compact(entry.title) === compact(topic));
  let text = chapter ? section(spec, chapter, specEntries) : '';
  for (const file of modules.get(topic) ?? []) {
    const body = read(file).trim();
    text += '\n\n' + (chapter ? body.replace(/^#/gm, '###') : body);
  }
  const examples = resolve(ROOT, 'modules', topic, 'examples');
  if (existsSync(examples)) {
    const files = readdirSync(examples)
      .filter((file) => file.endsWith('.animl'))
      .sort();
    if (files.length)
      text +=
        '\n\nExamples (AniML sources with built .ani siblings):\n' +
        files.map((file) => '- modules/' + topic + '/examples/' + file).join('\n');
  }
  return text.trim();
}

function contents(title: string, command: string, entries: Heading[]): string {
  return (
    title +
    '\n\nContents (' +
    command +
    ' <section>):\n' +
    entries.map((entry) => '- ' + entry.slug + ': ' + entry.title).join('\n')
  );
}

function miss(topic: string, candidates: readonly string[], io: IO, json = false): number {
  const suggestion = nearest(topic, candidates);
  if (json) {
    const suggestions = suggestion ? [suggestion] : [];
    io.err(
      JSON.stringify({ error: `no docs topic "${topic}"`, suggestions, help: 'anima docs --list' }),
    );
    return 2;
  }
  io.err(
    suggestion
      ? 'no docs topic "' +
          topic +
          '"; did you mean "' +
          suggestion +
          '"? Try anima docs ' +
          suggestion +
          "\nSee 'anima docs --list'."
      : 'no docs topic "' + topic + "\"\nSee 'anima docs --list'.",
  );
  return 2;
}

function docsImpl(
  topic: string | undefined,
  list: boolean,
  json: boolean,
  io: IO,
  requestedSection?: string,
  full = false,
): number {
  const state = resolver();

  if (topic === 'spec' && (list || requestedSection)) {
    const entries = state.specHeadings;
    if (list) {
      io.out(
        json
          ? JSON.stringify(entries.map(({ title, slug: name }) => ({ title, slug: name })))
          : entries.map((entry) => entry.slug + '\t' + entry.title).join('\n'),
      );
      return 0;
    }
    const found = entries.find((entry) => compact(entry.slug) === compact(requestedSection!));
    if (!found)
      return miss(
        requestedSection!,
        entries.map((entry) => entry.slug),
        io,
        json,
      );
    const text = section(state.spec, found, entries);
    io.out(json ? JSON.stringify({ topic: 'spec', section: found.slug, text }) : text);
    return 0;
  }

  if (topic === 'authoring' && requestedSection) {
    const found = state.guideHeadings.find(
      (entry) => compact(entry.slug) === compact(requestedSection),
    );
    if (!found)
      return miss(
        requestedSection,
        state.guideHeadings.map((entry) => entry.slug),
        io,
        json,
      );
    const text = section(state.guide, found, state.guideHeadings);
    io.out(json ? JSON.stringify({ topic: 'authoring', section: found.slug, text }) : text);
    return 0;
  }

  if (list) {
    const listed = [
      ...new Set([
        'authoring',
        'spec',
        'markup',
        ...state.guideHeadings.map((entry) => entry.slug),
        ...state.specHeadings.map((entry) => entry.slug),
        ...state.modules.keys(),
      ]),
    ].sort();
    io.out(json ? JSON.stringify(listed) : listed.join('\n'));
    return 0;
  }

  if (!topic) {
    const text = contents(state.guide.split('\n')[0]!, 'anima docs authoring', state.guideHeadings);
    io.out(json ? JSON.stringify({ topic: 'authoring', text }) : text);
    return 0;
  }

  const resolved = state.resolve(topic);
  if (!resolved) return miss(topic, state.candidates, io, json);

  let text: string;
  switch (resolved.kind) {
    case 'authoring': {
      const index = contents(
        state.guide.split('\n')[0]!,
        'anima docs authoring',
        state.guideHeadings,
      );
      text = full ? state.guide : index + '\n\nThe whole guide: anima docs authoring --full';
      break;
    }
    case 'spec':
      text = full
        ? state.spec
        : contents(state.spec.split('\n')[0]!, 'anima docs spec', state.specHeadings);
      break;
    case 'markup':
      text = read('spec/ANIML.md');
      break;
    case 'guide-section':
      text = section(state.guide, resolved.heading, state.guideHeadings);
      break;
    case 'spec-section':
      text = section(state.spec, resolved.heading, state.specHeadings);
      break;
    case 'module':
      text = moduleText(resolved.topic, state.spec, state.modules);
      break;
  }

  // A second word narrows the page to one of its sections (`docs a11y <section>`); unknown ones miss.
  if (requestedSection) {
    const entries = headings(text, [2, 3, 4, 5, 6]);
    const found = entries.find((entry) => compact(entry.slug) === compact(requestedSection));
    if (!found)
      return miss(
        requestedSection,
        entries.map((entry) => entry.slug),
        io,
        json,
      );
    text = section(text, found, entries);
  }

  io.out(json ? JSON.stringify({ topic: resolved.topic, text }) : text);
  return 0;
}

export function docs(
  topic: string | undefined,
  list: boolean,
  json: boolean,
  io: IO,
  requestedSection?: string,
): number {
  return docsImpl(topic, list, json, io, requestedSection, false);
}

export function docsFull(
  topic: string | undefined,
  list: boolean,
  json: boolean,
  io: IO,
  requestedSection?: string,
): number {
  return docsImpl(topic, list, json, io, requestedSection, true);
}

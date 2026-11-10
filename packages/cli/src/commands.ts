import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { ELEMENTS, NODE_TYPES } from '@anima-format/core';

// The `anima` command table (design/discovery/DESIGN.md D1): the only source of usage text. Help,
// parsing, flag validation, suggestions, `anima help --json`, completion and docs/CLI.md derive from
// it. D-A owns this file and fills `COMMANDS`; the types change only through the orchestrator.

export type Group = 'write' | 'check' | 'see' | 'find' | 'ship' | 'assets';

export const GROUPS: Record<Group, string> = {
  write: 'Write',
  check: 'Check',
  see: 'See',
  find: 'Find',
  ship: 'Ship',
  assets: 'Fonts and assets',
};

export interface Option {
  /** Long name without dashes, e.g. `size`. */
  name: string;
  /** One-letter alias without the dash, e.g. `o`. */
  short?: string;
  /** Value placeholder (`px`, `file`); absent for boolean flags. */
  value?: string;
  /** Allowed values, for enum options (`contain`, `cover`, …); used for suggestions and completion. */
  choices?: readonly string[];
  /** May be given more than once (`--font a=x --font b=y`). */
  multiple?: boolean;
  /** One line. */
  summary: string;
  /** Default shown in help. */
  default?: string;
}

export interface Command {
  name: string;
  group: Group;
  /** One line for the overview. */
  summary: string;
  /** Usage lines without the leading `anima ` (`render <file> -o out.svg|png [--at t]`). */
  usage: string[];
  options: Option[];
  /** Subcommand names, when the command has them (`library update`). */
  subcommands?: { name: string; summary: string }[];
  /** Positional topics or values it accepts, for suggestions (`docs` topics, `--sample` names). */
  topics?: () => readonly string[];
  /** Short worked examples, without the leading `anima `, each with a one-line note. */
  examples: { run: string; note: string }[];
  /** Related commands and docs topics (`docs authoring/the-loop`). */
  see?: string[];
  aliases?: string[];
  /** Hidden from the overview (still listed by `help --all` and `help --json`). */
  hidden?: boolean;
}

/** Options every command accepts. */
export const GLOBAL: Option[] = [
  {
    name: 'format',
    value: 'text|json',
    choices: ['text', 'json'],
    summary: 'output format',
    default: 'text',
  },
  { name: 'help', short: 'h', summary: 'show this command’s help' },
];

const ROOT = new URL('../../../', import.meta.url);
const font: Option = {
  name: 'font',
  value: 'name=path',
  multiple: true,
  summary: 'install a local font for text measurement and rendering',
};

const script: Option = {
  name: 'script',
  short: 's',
  value: 'file',
  summary: 'read script commands from a file',
};
const evalScript: Option = {
  name: 'eval',
  short: 'e',
  value: 'cmds',
  summary: 'run semicolon-separated script commands',
};
const reducedMotion: Option = {
  name: 'reduced-motion',
  summary: 'run with reduced motion enabled',
};
const all: Option = { name: 'all', summary: 'include all values in snapshots' };
const semantics: Option = {
  name: 'semantics',
  summary: 'include semantic state in snapshots',
};
const seed: Option = { name: 'seed', value: 'N', summary: 'set the uint32 script random seed' };
const out: Option = { name: 'out', short: 'o', value: 'file', summary: 'write output to a file' };
const scriptOptions = [script, evalScript, reducedMotion, all, semantics, seed] as const;

function authoringTopics(): string[] {
  const file = new URL('docs/AUTHORING.md', ROOT);
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/^##+\s+(.+)$/gm)].map((match) =>
    match[1]!
      .replace(/`/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
  );
}

function docsTopics(): string[] {
  const modules = new URL('modules/', ROOT);
  const moduleTopics = existsSync(modules)
    ? readdirSync(modules, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];
  return [
    ...new Set(['authoring', 'spec', 'markup', ...authoringTopics(), ...moduleTopics]),
  ].sort();
}

function schemaTopics(): string[] {
  return [
    ...new Set([
      ...NODE_TYPES,
      ...Object.keys(ELEMENTS),
      'anima',
      'fill',
      'stroke',
      'a11y',
      'timeline',
      'layer',
      'state',
      'pose',
      'transition',
      'listener',
      'input',
    ]),
  ].sort();
}

export const COMMANDS: Command[] = [
  {
    name: 'new',
    group: 'write',
    summary: 'scaffold an animation from a glyph, Glyphy project, or bundled sample',
    usage: [
      'new <name> --glyph <file.svg> | --glyphy <project-dir> [-o out.animl] [--ani] [--force]',
      'new <directory> --sample bell|moon|progress',
    ],
    options: [
      { name: 'glyph', value: 'file.svg', summary: 'scaffold from an SVG glyph' },
      { name: 'glyphy', value: 'project-dir', summary: 'scaffold from a Glyphy project' },
      {
        name: 'sample',
        value: 'name',
        choices: ['bell', 'moon', 'progress'],
        summary: 'copy a bundled sample project',
      },
      out,
      { name: 'ani', summary: 'write canonical JSON instead of AniML' },
      { name: 'force', summary: 'overwrite an existing scaffold output' },
    ],
    examples: [
      {
        run: 'new bell-copy --glyph fixtures/glyphs/bell.svg -o /tmp/bell-copy.animl',
        note: 'scaffold AniML from the bell glyph',
      },
      { run: 'new /tmp/anima-sample --sample bell', note: 'copy the bundled bell project' },
    ],
    see: ['validate', 'inspect', 'docs authoring'],
  },
  {
    name: 'fmt',
    group: 'write',
    summary: 'format AniML or .ani canonically',
    usage: ['fmt <file> [--write | --check]'],
    options: [
      { name: 'write', summary: 'replace the file with canonical formatting' },
      { name: 'check', summary: 'check formatting without writing' },
    ],
    examples: [
      { run: 'fmt examples/bell.animl --check', note: 'verify canonical AniML formatting' },
      { run: 'fmt examples/bell.ani', note: 'print canonical JSON' },
    ],
    see: ['validate', 'decompile'],
  },
  {
    name: 'import',
    group: 'write',
    summary: 'import supported SVG or Lottie features as AniML',
    usage: ['import <file.svg|file.json> [-o out.animl]'],
    options: [out],
    examples: [
      {
        run: 'import fixtures/glyphs/bell.svg -o /tmp/bell-import.animl',
        note: 'import the reference bell SVG',
      },
    ],
    see: ['new', 'validate'],
  },
  {
    name: 'decompile',
    group: 'write',
    summary: 'write canonical AniML from a .ani document',
    usage: ['decompile <file.ani> [-o out.animl]'],
    options: [out],
    examples: [
      {
        run: 'decompile examples/bell.ani -o /tmp/bell.animl',
        note: 'convert the bell JSON document to AniML',
      },
    ],
    see: ['build', 'fmt'],
  },
  {
    name: 'flatten',
    group: 'write',
    summary: 'convert text to outlines',
    usage: ['flatten <file> [--node id] [-o out.ani] [--font name=path]'],
    options: [{ name: 'node', value: 'id', summary: 'flatten only one text node' }, out, font],
    examples: [
      {
        run: 'flatten examples/bell.animl -o /tmp/bell-flat.ani',
        note: 'flatten any text in the bell document',
      },
    ],
    see: ['import-font', 'build'],
  },
  {
    name: 'library',
    group: 'write',
    summary: 'maintain vendored AniML library imports',
    usage: ['library update <file.animl> [--check]'],
    options: [{ name: 'check', summary: 'report stale vendored imports without changing files' }],
    subcommands: [{ name: 'update', summary: 'refresh vendored imports from local source paths' }],
    examples: [
      {
        run: 'library update examples/bell.animl --check',
        note: 'check the bell library imports',
      },
    ],
    see: ['build', 'validate'],
  },
  {
    name: 'validate',
    group: 'check',
    summary: 'validate a document and print every diagnostic',
    usage: ['validate <file> [--font name=path]'],
    options: [font],
    aliases: ['check', 'lint'],
    examples: [
      { run: 'validate examples/bell.animl', note: 'validate the reference AniML scene' },
      {
        run: 'validate examples/bell.ani --format=json',
        note: 'emit machine-readable diagnostics',
      },
    ],
    see: ['inspect', 'schema'],
  },
  {
    name: 'compare',
    group: 'check',
    summary: 'compare two PNG files by RGBA pixels',
    usage: ['compare a.png b.png [--tolerance 0..255] [-o diff.png]'],
    options: [
      {
        name: 'tolerance',
        value: '0..255',
        summary: 'maximum channel difference before a pixel fails',
        default: '0',
      },
      out,
    ],
    examples: [
      {
        run: 'compare examples/moon-toggle.png examples/moon-toggle.png',
        note: 'compare an image with itself',
      },
    ],
    see: ['render'],
  },
  {
    name: 'bench',
    group: 'check',
    summary: 'measure compile and frame costs',
    usage: ['bench <file> [-s script | -e "cmds"] [--frames N] [--font name=path]'],
    options: [
      ...scriptOptions,
      { name: 'frames', value: 'N', summary: 'number of frames to benchmark', default: '600' },
      font,
    ],
    examples: [
      {
        run: 'bench examples/bell.animl --frames 60',
        note: 'benchmark the bell for 60 frames',
      },
    ],
    see: ['sample', 'render'],
  },
  {
    name: 'doctor',
    group: 'check',
    summary: 'check Node, browsers, cache, and module wiring',
    usage: ['doctor'],
    options: [],
    examples: [{ run: 'doctor', note: 'check the local Anima toolchain' }],
    see: ['playground', 'bundle'],
  },
  {
    name: 'inspect',
    group: 'see',
    summary: 'inspect document structure, animation, inputs, and wiring',
    usage: ['inspect <file> [--summary] [--font name=path]'],
    options: [{ name: 'summary', summary: 'print only wiring diagnostics' }, font],
    examples: [
      { run: 'inspect examples/bell.animl', note: 'inspect the reference bell' },
      {
        run: 'inspect examples/bell.animl --summary',
        note: 'show only wiring findings',
      },
    ],
    see: ['validate', 'schema'],
  },
  {
    name: 'sample',
    group: 'see',
    summary: 'run a script and print snapshots as JSON lines',
    usage: [
      'sample <file> [-s script | -e "cmds"] [--reduced-motion] [--all] [--semantics] [--seed N] [--font name=path]',
    ],
    options: [...scriptOptions, font],
    examples: [
      {
        run: 'sample examples/bell.animl -e "advance 0.2;snapshot"',
        note: 'sample the bell after 0.2 seconds',
      },
      {
        run: 'sample examples/bell.animl -e "semantics;snapshot --semantics"',
        note: 'inspect semantic output headlessly',
      },
    ],
    see: ['session', 'docs authoring'],
  },
  {
    name: 'session',
    group: 'see',
    summary: 'run a persistent JSON-line script session',
    usage: [
      'session <file> [--reduced-motion] [--all] [--semantics] [--seed N] [--font name=path]',
    ],
    options: [reducedMotion, all, semantics, seed, font],
    examples: [
      { run: 'session examples/bell.animl', note: 'open a persistent session for the bell' },
    ],
    see: ['sample', 'bench'],
  },
  {
    name: 'render',
    group: 'see',
    summary: 'render frames, sheets, sequences, components, probes, or comparisons',
    usage: [
      'render <file> -o out.svg|png|webm [--font name=path] [--at t] [-s script | -e "cmds"] [--size px]',
      'render <file> --compare glyph.svg [--size px] [--tolerance 0..255] [-o diff.png]',
      'render [file] [--component name] [--fit contain|cover|fill|none] [--viewport WxH] [--frames N] [--fps N] [--scale k] [--probe "x,y;x,y"] [--preset name] [--audio out.wav]',
    ],
    options: [
      font,
      { name: 'browser-text', summary: 'render text through the browser font path' },
      { name: 'component', value: 'name', summary: 'render one component as the root' },
      {
        name: 'fit',
        value: 'mode',
        choices: ['contain', 'cover', 'fill', 'none'],
        summary: 'fit the frame into the viewport',
        default: 'contain',
      },
      { name: 'viewport', value: 'WxH', summary: 'set output viewport dimensions' },
      {
        name: 'scale',
        value: 'k',
        summary: 'scale inside the viewport, from 0 to 1',
        default: '1',
      },
      { name: 'probe', value: 'x,y;x,y', summary: 'sample final PNG pixels at coordinates' },
      { name: 'preset', value: 'name', multiple: true, summary: 'apply a project render preset' },
      { name: 'fps', value: 'N', summary: 'sequence frame rate', default: '60' },
      { name: 'audio', value: 'out.wav', summary: 'mix captured audio events to WAV' },
      ...scriptOptions,
      { name: 'frames', value: 'N', summary: 'render a frame sequence' },
      out,
      { name: 'at', value: 'seconds', summary: 'advance to a nonnegative time before rendering' },
      { name: 'size', value: 'px', summary: 'square render size', default: '240' },
      { name: 'sheet', value: 'N', summary: 'render a labelled contact sheet' },
      { name: 'over', value: 'seconds', summary: 'contact-sheet time span' },
      { name: 'dark', summary: 'use the dark render look' },
      { name: 'color', value: 'slot=#hex', multiple: true, summary: 'override a paint slot' },
      { name: 'current', value: '#hex', summary: 'override currentColor' },
      { name: 'background', value: '#hex', summary: 'set the output background' },
      {
        name: 'compare',
        value: 'file.svg',
        summary: 'compare one rendered frame with an SVG glyph',
      },
      {
        name: 'tolerance',
        value: '0..255',
        summary: 'comparison channel tolerance',
        default: '0',
      },
    ],
    aliases: ['show', 'draw'],
    examples: [
      { run: 'render examples/bell.animl -o /tmp/bell.svg', note: 'render the bell to SVG' },
      {
        run: 'render examples/bell.animl -o /tmp/bell.png --size 256',
        note: 'render a 256px PNG',
      },
      {
        run: 'render examples/bell.animl --compare fixtures/glyphs/bell.svg',
        note: 'compare the rest frame with the source glyph',
      },
    ],
    see: ['inspect', 'compare', 'docs authoring'],
  },
  {
    name: 'playground',
    group: 'see',
    summary: 'open the local live editor',
    usage: ['playground [file.animl] [--port 4519]'],
    options: [{ name: 'port', value: 'N', summary: 'local HTTP port', default: '4519' }],
    examples: [
      {
        run: 'playground examples/bell.animl --port 4519',
        note: 'edit the bell in the local playground',
      },
    ],
    see: ['doctor', 'render'],
  },
  {
    name: 'docs',
    group: 'see',
    summary: 'read the authoring guide, format spec, markup spec, or module docs',
    usage: ['docs [authoring | spec | markup | <section>] [section-slug] [--list | --full]'],
    options: [
      { name: 'list', summary: 'list available topics or sections' },
      { name: 'full', summary: 'print a long section in full instead of its contents first' },
    ],
    topics: docsTopics,
    aliases: ['topics'],
    examples: [
      { run: 'docs authoring the-loop', note: 'read the core authoring loop' },
      { run: 'docs spec', note: 'read the .ani format specification' },
      { run: 'docs markup', note: 'read the AniML markup specification' },
    ],
    see: ['schema', 'features', 'search'],
  },
  {
    name: 'schema',
    group: 'see',
    summary: 'inspect registry fields, types, spellings, and JSON Schema',
    usage: [
      'schema [type | fill | stroke | a11y | timeline | layer | state | pose | transition | listener | input] [--all | --json-schema]',
      'schema --search <words> | <type>.<field> [--animatable] [--bindable] [--inherited] [--editor-only]',
    ],
    options: [
      { name: 'search', value: 'words', summary: 'search registry names and diagnostic codes' },
      { name: 'animatable', summary: 'show animatable fields only' },
      { name: 'bindable', summary: 'show bindable fields only' },
      { name: 'inherited', summary: 'show inherited fields only' },
      { name: 'editor-only', summary: 'show editor-only fields when applicable' },
      { name: 'all', summary: 'print every type and field instead of the topic index' },
      { name: 'json-schema', summary: 'print the complete generated JSON Schema' },
    ],
    topics: schemaTopics,
    examples: [
      { run: 'schema rect', note: 'inspect rectangle fields and spellings' },
      { run: 'schema listener --format=json', note: 'inspect listener fields as JSON' },
      { run: 'schema --search width', note: 'search schema vocabulary' },
    ],
    see: ['docs', 'search'],
  },
  {
    name: 'features',
    group: 'find',
    summary: 'list capabilities provided by Anima features',
    usage: ['features [name]'],
    options: [],
    examples: [
      { run: 'features', note: 'list all feature names and summaries' },
      { run: 'features paint', note: 'show what the paint feature provides' },
    ],
    see: ['search', 'examples', 'docs'],
  },
  {
    name: 'search',
    group: 'find',
    summary: 'search the capability index',
    usage: ['search <words…> [--kind k] [--limit n]'],
    options: [
      {
        name: 'kind',
        value: 'k',
        multiple: true,
        choices: [
          'feature',
          'type',
          'field',
          'element',
          'address',
          'ease',
          'function',
          'event',
          'script',
          'diagnostic',
          'doc',
          'example',
          'capability',
          'command',
          'api',
        ],
        summary: 'limit results to one or more entry kinds',
      },
      { name: 'limit', value: 'n', summary: 'maximum result count', default: '10' },
    ],
    aliases: ['find', 'grep'],
    examples: [
      { run: 'search "hover effect"', note: 'find capabilities related to hover' },
      {
        run: 'search ik --kind capability --limit 5',
        note: 'find IK capability rows',
      },
    ],
    see: ['features', 'examples', 'docs', 'schema'],
  },
  {
    name: 'examples',
    group: 'find',
    summary: 'find, print, or copy example scenes',
    usage: ['examples [topic|name] [--print | -o dir]'],
    options: [
      { name: 'print', summary: 'print one matching example file' },
      { ...out, value: 'dir', summary: 'copy one matching example into a directory' },
    ],
    examples: [
      { run: 'examples bell', note: 'find bell examples' },
      { run: 'examples bell --print', note: 'print the matching bell example' },
    ],
    see: ['features', 'search'],
  },
  {
    name: 'help',
    group: 'find',
    summary: 'show overview, command help, or the command table',
    usage: ['help [command] [--all] [--json]'],
    options: [
      { name: 'all', summary: 'include hidden commands in the overview' },
      { name: 'json', summary: 'print the command table as JSON' },
    ],
    topics: () => COMMANDS.map((command) => command.name),
    examples: [
      { run: 'help', note: 'show the grouped command overview' },
      { run: 'help render', note: 'show render usage, options, and examples' },
      { run: 'help --json', note: 'print the machine-readable command table' },
    ],
    see: ['features', 'search'],
  },
  {
    name: 'build',
    group: 'ship',
    summary: 'compile AniML or export a self-contained local web build',
    usage: [
      'build <file.animl|page.html> [-o out] [--embed] [--font name=path]',
      'build [file] --out-dir <directory> [--font name=path]',
    ],
    options: [
      out,
      {
        name: 'out-dir',
        value: 'directory',
        summary: 'export .ani, runtime, and HTML into a directory',
      },
      { name: 'embed', summary: 'embed build assets into the compiled document' },
      font,
    ],
    examples: [
      {
        run: 'build examples/bell.animl -o /tmp/bell.ani',
        note: 'compile the bell to canonical JSON',
      },
      {
        run: 'build examples/bell.animl --out-dir /tmp/bell-site',
        note: 'export a local web build',
      },
    ],
    see: ['bundle', 'validate'],
  },
  {
    name: 'bundle',
    group: 'ship',
    summary: 'bundle selected browser runtime modules',
    usage: ['bundle [--modules paint,bind] [-o anima.js] [--verbose]'],
    options: [
      { name: 'modules', value: 'name,name', summary: 'comma-separated runtime modules' },
      out,
      { name: 'verbose', summary: 'print module size detail' },
    ],
    examples: [
      {
        run: 'bundle --modules paint,bind -o /tmp/anima.js',
        note: 'bundle the paint and bind runtime modules',
      },
    ],
    see: ['build', 'doctor'],
  },
  {
    name: 'completion',
    group: 'ship',
    summary: 'generate shell completion from the command table',
    usage: ['completion bash|zsh|fish'],
    options: [],
    topics: () => ['bash', 'zsh', 'fish'],
    examples: [{ run: 'completion bash', note: 'print Bash completion source' }],
    see: ['help'],
  },
  {
    name: 'version',
    group: 'ship',
    summary: 'print the CLI package version',
    usage: ['version'],
    options: [],
    examples: [{ run: 'version', note: 'print the installed CLI version' }],
    see: ['help'],
  },
  {
    name: 'import-font',
    group: 'assets',
    summary: 'store, subset, or fetch a font at build time',
    usage: [
      'import-font <font> -o local.ttf [--chars "ABC"]',
      'import-font --google "Family:wght@400;600" -o local.ttf [--chars "ABC"]',
    ],
    options: [
      out,
      {
        name: 'google',
        value: 'family:axes@values',
        summary: 'fetch a Google Font at build time',
      },
      { name: 'chars', value: 'text', summary: 'subset the font to these characters' },
    ],
    examples: [
      {
        run: 'import-font fixtures/fonts/anima-test.ttf -o /tmp/anima-test.ttf --chars "Anima"',
        note: 'subset the bundled test font',
      },
    ],
    see: ['flatten', 'build'],
  },
];

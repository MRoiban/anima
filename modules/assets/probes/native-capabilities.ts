import { format, resolveConfig } from 'prettier';
// Local CLI capability observations. Persist only our summary/data, never CLI docs text.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { compare } from '../../../tools/oracle.ts';
const rive = homedir() + '/.rive/bin/rive';
const run = (...args: string[]) =>
  execFileSync(rive, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const schema = (type: string, all = false) =>
  [
    ...run('schema', type, ...(all ? ['--all'] : [])).matchAll(
      /^ {2}(\w+)\s+(?:uint|double|bool|String|Bytes|Id|List)/gm,
    ),
  ].map((m) => m[1]);
run('docs', 'assets');
const yamlDocs = run('docs', 'project/rive-yaml');
const help = spawnSync(
  rive,
  [
    'tests/oracle/assets-image-filter-bilinear/rive',
    '--commands=' + resolve('modules/assets/probes/help.commands.txt'),
  ],
  { input: 'help\n', encoding: 'utf8' },
);
if (help.status !== 0 || !help.stdout.includes('ok help'))
  throw Error('headless help did not execute');
const commands = [...help.stderr.matchAll(/rive {3,}([a-z][a-z-]*)/g)].map((m) => m[1]!);
if (!commands.includes('screenshot') || !commands.includes('data-dump') || commands.length < 14)
  throw Error('command vocabulary parsing failed');
const encodings = ['png', 'jpeg', 'webp'].map((format) => {
  const dir = 'modules/assets/probes/encoding/' + format;
  const runtime = run('inspect', dir),
    authored = run('inspect', dir, '--all');
  const { diff, ...pixels } = compare(
    readFileSync(dir + '/frame.png'),
    readFileSync('tests/oracle/assets-image-import-png/rive/frames/0.png'),
    16,
  );
  void diff;
  return {
    format,
    authoredFormatVisible: authored.includes('"format"'),
    runtimeFormatVisible: runtime.includes('"format"'),
    versusUnencodedPNG: pixels,
  };
});
const audio = ['wav', 'flac', 'mp3'].map((format) => {
  const dir = 'modules/assets/probes/audio/native-' + format;
  const session = readFileSync(dir + '/session.txt', 'utf8');
  if (!session.includes('sound pulse: triggered') || !session.includes('0 errors'))
    throw Error('native audio failed');
  return {
    format,
    sourceSHA256: createHash('sha256')
      .update(readFileSync(dir + '/pulse.' + format))
      .digest('hex'),
    buildErrors: 0,
    triggered: true,
    pcmOutput: false,
  };
});
const result = {
  command: '~/.rive/bin/rive',
  version: '1.9.1',
  queries: [
    'docs assets',
    'docs project/rive-yaml',
    'schema ImageAsset',
    'schema ImageAsset --all',
    'schema AudioAssetClip',
    'schema AudioAssetClip --all',
    'schema BlobAsset',
    'schema FileAsset',
    'headless --commands=help',
  ],
  headlessCommands: commands,
  // These are assertions of observed capability limits, not copied prose.
  limits: {
    imageEncodingIsEditorOnly: encodings.every(
      (e) =>
        e.authoredFormatVisible && !e.runtimeFormatVisible && e.versusUnencodedPNG.maxDiff === 0,
    ),
    clipBoundsAreEditorOnly:
      !schema('AudioAssetClip').includes('startSeconds') &&
      schema('AudioAssetClip', true).includes('startSeconds'),
    audioExportFormatIsEditorOnly:
      !schema('AudioAssetClip').includes('exportFormatValue') &&
      schema('AudioAssetClip', true).includes('exportFormatValue'),
    headlessAudioReportsTriggers: audio.every((e) => e.triggered),
    exportExclusionTargetsEditorRev:
      yamlDocs.includes('excludeFromRev') && yamlDocs.includes('contents'),
    noJavaScriptHostInCommandVocabulary: commands.every(
      (c) =>
        ![
          'asset-loader',
          'asset-policy',
          'decode-audio',
          'resolve-asset',
          'asset-metadata',
          'replace-image',
          'blob-read',
          'render-audio',
        ].includes(c),
    ),
  },
  runtimeFields: {
    ImageAsset: schema('ImageAsset'),
    AudioAssetClip: schema('AudioAssetClip'),
    BlobAsset: schema('BlobAsset'),
    FileAsset: schema('FileAsset'),
  },
  encodings,
  audio,
};
if (Object.values(result.limits).some((v) => !v))
  throw Error('native capability limit changed; reassess skips');
writeFileSync(
  'modules/assets/probes/native-capabilities.json',
  await format(JSON.stringify(result), {
    ...(await resolveConfig('modules/assets/probes/native-capabilities.json')),
    parser: 'json',
  }),
);
console.log(JSON.stringify(result, null, 2));

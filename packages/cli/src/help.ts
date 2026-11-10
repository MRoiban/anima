import { COMMANDS, GLOBAL, GROUPS, type Command, type Option } from './commands.ts';

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function wrap(text: string, width: number, first = '', continuation = first): string {
  const parts = words(text);
  if (!parts.length) return first.trimEnd();
  const lines: string[] = [];
  let prefix = first;
  let line = prefix;
  for (const part of parts) {
    const separator = line === prefix ? '' : ' ';
    if (line.length + separator.length + part.length > width && line !== prefix) {
      lines.push(line);
      prefix = continuation;
      line = prefix + part;
    } else line += separator + part;
  }
  lines.push(line);
  return lines.join('\n');
}

function optionLabel(option: Option): string {
  const long = `--${option.name}${option.value ? ` <${option.value}>` : ''}`;
  return option.short ? `-${option.short}, ${long}` : long;
}

function tableRows(rows: { label: string; text: string }[], width: number, indent = '  '): string {
  const labelWidth = Math.min(42, Math.max(0, ...rows.map(({ label }) => label.length)) + 2);
  return rows
    .map(({ label, text }) => {
      if (indent.length + label.length + 2 > Math.max(32, width * 0.58))
        return `${wrap(label, width, indent, indent + '  ')}\n${wrap(
          text,
          width,
          indent + '    ',
          indent + '    ',
        )}`;
      const left = indent + label.padEnd(Math.max(labelWidth, label.length + 2));
      return wrap(text, width, left, ' '.repeat(left.length));
    })
    .join('\n');
}

export function commandByName(name: string): Command | undefined {
  return COMMANDS.find((command) => command.name === name || command.aliases?.includes(name));
}

export function overview(all = false, width = process.stdout.columns ?? 100): string {
  const lines = [
    'anima — check, see, and build .animl and .ani animations',
    '',
    'Usage:',
    '  anima <command> [options]',
  ];
  for (const [group, title] of Object.entries(GROUPS)) {
    const commands = COMMANDS.filter(
      (command) => command.group === group && (all || !command.hidden),
    );
    if (!commands.length) continue;
    lines.push(
      '',
      title,
      tableRows(
        commands.map((command) => ({
          label: `anima ${command.usage[0]}`,
          text: command.summary,
        })),
        width,
      ),
    );
  }
  lines.push(
    '',
    wrap(
      'Every command accepts --format <text|json> and -h/--help. Exit codes: 0 ok, 1 diagnostics or a failed check, 2 usage.',
      width,
    ),
    '',
    '  anima features                 what Anima can do',
    '  anima search <words>           find a capability',
    '  anima docs authoring the-loop  follow the authoring loop',
  );
  return lines.join('\n');
}

export function commandHelp(command: Command, width = process.stdout.columns ?? 100): string {
  const lines = [
    wrap(`anima ${command.name} — ${command.summary}`, width),
    '',
    'Usage:',
    ...command.usage.map((usage) => wrap(`anima ${usage}`, width, '  ', '    ')),
  ];
  if (command.subcommands?.length)
    lines.push(
      '',
      'Subcommands:',
      tableRows(
        command.subcommands.map((subcommand) => ({
          label: subcommand.name,
          text: subcommand.summary,
        })),
        width,
      ),
    );
  const options = [...command.options, ...GLOBAL];
  if (options.length)
    lines.push(
      '',
      'Options:',
      tableRows(
        options.map((option) => ({
          label: optionLabel(option),
          text: `${option.summary}${option.default === undefined ? '' : ` (default: ${option.default})`}`,
        })),
        width,
      ),
    );
  if (command.examples.length)
    lines.push(
      '',
      'Examples:',
      ...command.examples.flatMap((example) => [
        wrap(`anima ${example.run}`, width, '  ', '    '),
        wrap(example.note, width, '    ', '    '),
      ]),
    );
  if (command.see?.length)
    lines.push(
      '',
      'See also:',
      wrap(command.see.map((item) => `anima ${item}`).join(', '), width, '  ', '  '),
    );
  return lines.join('\n');
}

export function helpJSON(): string {
  return JSON.stringify(
    {
      groups: GROUPS,
      global: GLOBAL,
      commands: COMMANDS.map((command) => ({
        ...command,
        ...(command.topics ? { topics: command.topics() } : {}),
      })),
    },
    null,
    2,
  );
}

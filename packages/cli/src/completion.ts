import { COMMANDS, GLOBAL, type Command, type Option } from './commands.ts';

export type Shell = 'bash' | 'zsh' | 'fish';

function values(command: Command): string[] {
  return [...(command.subcommands?.map(({ name }) => name) ?? []), ...(command.topics?.() ?? [])];
}

function flags(command: Command): string[] {
  return [...command.options, ...GLOBAL].flatMap((option) => [
    `--${option.name}`,
    ...(option.short ? [`-${option.short}`] : []),
  ]);
}

function choiceCases(command: Command): string[] {
  return [...command.options, ...GLOBAL]
    .filter((option) => option.choices?.length)
    .map(
      (option) =>
        `      --${option.name}${option.short ? `|-${option.short}` : ''}) COMPREPLY=( $(compgen -W '${option.choices!.join(' ')}' -- "$cur") ); return ;;`,
    );
}

function bash(): string {
  const commands = COMMANDS.flatMap((command) => [command.name, ...(command.aliases ?? [])]).join(
    ' ',
  );
  const cases = COMMANDS.map((command) => {
    const positional = values(command).join(' ');
    return `    ${[command.name, ...(command.aliases ?? [])].join('|')})
      case "$prev" in
${choiceCases(command).join('\n')}
      esac
      if [[ "$cur" == -* ]]; then
        COMPREPLY=( $(compgen -W '${flags(command).join(' ')}' -- "$cur") )
      else
        COMPREPLY=( $(compgen -W '${positional}' -- "$cur") )
      fi
      ;;`;
  }).join('\n');
  const globalChoices = GLOBAL.filter((option) => option.choices?.length)
    .map(
      (option) =>
        `    --${option.name}) COMPREPLY=( $(compgen -W '${option.choices!.join(' ')}' -- "$cur") ); return ;;`,
    )
    .join('\n');
  // Options that take a separate value, so the scan above can skip their value.
  const valued = [
    ...new Set(
      [...GLOBAL, ...COMMANDS.flatMap((command) => command.options)]
        .filter((option) => option.value)
        .flatMap((option) => [`--${option.name}`, ...(option.short ? [`-${option.short}`] : [])]),
    ),
  ].join('|');
  return `# bash completion for anima
_anima_completion() {
  local cur prev cmd
  cur="${'${COMP_WORDS[COMP_CWORD]}'}"
  prev="${'${COMP_WORDS[COMP_CWORD-1]}'}"
  # Global options with choices complete the same before or after the command.
  case "$prev" in
${globalChoices}
  esac
  # The command is the first word that is not a leading option or its value (anima --format json search …).
  local i word
  cmd=""
  for (( i = 1; i < COMP_CWORD; i++ )); do
    word="${'${COMP_WORDS[i]}'}"
    case "$word" in
      ${valued}) (( i++ )) ;;
      -*) ;;
      *) cmd="$word"; break ;;
    esac
  done
  if [[ -z "$cmd" ]]; then
    if [[ "$cur" == -* ]]; then
      COMPREPLY=( $(compgen -W '--help --version --format' -- "$cur") )
    else
      COMPREPLY=( $(compgen -W '${commands}' -- "$cur") )
    fi
    return
  fi
  case "$cmd" in
${cases}
  esac
}
complete -F _anima_completion anima
`;
}

function zshOption(option: Option): string {
  const names = [`--${option.name}`, ...(option.short ? [`-${option.short}`] : [])].join(',');
  const choice = option.choices?.length
    ? `:value:(${option.choices.join(' ')})`
    : option.value
      ? `:value:`
      : '';
  return `'${names}[${option.summary.replaceAll("'", "'")}]${choice}'`;
}

function zsh(): string {
  // Aliases complete like their command (`anima check` → validate's options).
  const commandRows = COMMANDS.flatMap((command) =>
    [command.name, ...(command.aliases ?? [])].map(
      (name) => `    '${name}:${command.summary.replaceAll("'", '')}'`,
    ),
  ).join('\n');
  const cases = COMMANDS.map((command) => {
    const args = [...command.options, ...GLOBAL]
      .map((option) => `        ${zshOption(option)}`)
      .join(' \\\n');
    const topic = values(command);
    const positional = topic.length ? ` \\\n        '*:value:(${topic.join(' ')})'` : '';
    return `    ${[command.name, ...(command.aliases ?? [])].join('|')})
      _arguments \\\n${args}${positional}
      ;;`;
  }).join('\n');
  return `#compdef anima
# zsh completion for anima
_anima() {
  local state command
  _arguments '1:command:->command' '*::arg:->args'
  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      command=$words[2]
      case $command in
${cases}
      esac
      ;;
  esac
}
local -a commands
commands=(
${commandRows}
)
_anima "$@"
`;
}

function fishOption(command: Command, option: Option): string {
  const pieces = [
    `complete -c anima -n '__fish_seen_subcommand_from ${[command.name, ...(command.aliases ?? [])].join(' ')}'`,
    `-l ${option.name}`,
  ];
  if (option.short) pieces.push(`-s ${option.short}`);
  if (option.value) pieces.push('-r');
  if (option.choices?.length) pieces.push(`-a '${option.choices.join(' ')}'`);
  pieces.push(`-d '${option.summary.replaceAll("'", "\\'")}'`);
  return pieces.join(' ');
}

function fish(): string {
  // Aliases complete like their command (`anima check --f` offers validate's flags).
  const commandLines = COMMANDS.flatMap((command) =>
    [command.name, ...(command.aliases ?? [])].map(
      (name) =>
        `complete -c anima -f -n '__fish_use_subcommand' -a '${name}' -d '${command.summary.replaceAll("'", "\\'")}'`,
    ),
  );
  const detailLines = COMMANDS.flatMap((command) => [
    ...[...command.options, ...GLOBAL].map((option) => fishOption(command, option)),
    ...(values(command).length
      ? [
          `complete -c anima -f -n '__fish_seen_subcommand_from ${[command.name, ...(command.aliases ?? [])].join(' ')}' -a '${values(command).join(' ')}'`,
        ]
      : []),
  ]);
  return ['# fish completion for anima', ...commandLines, ...detailLines, ''].join('\n');
}

export function completion(shell: Shell): string {
  if (shell === 'bash') return bash();
  if (shell === 'zsh') return zsh();
  return fish();
}

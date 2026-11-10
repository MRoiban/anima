// The `anima` command table (design/discovery/DESIGN.md D1): the only source of usage text. Help,
// parsing, flag validation, suggestions, `anima help --json`, completion and docs/CLI.md derive from
// it. D-A owns this file and fills `COMMANDS`; the types change only through the orchestrator.

export type Group = 'write' | 'check' | 'see' | 'find' | 'ship' | 'assets';

export const GROUPS: Record<Group, string> = {
  write: 'Write and scaffold',
  check: 'Check',
  see: 'See and run',
  find: 'Find capabilities',
  ship: 'Build and ship',
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

/** Filled by D-A. */
export const COMMANDS: Command[] = [];

# Anima documentation

Pick the entry point that fits what you want to do.

## I want to use Anima

| Goal | Read |
|---|---|
| Make my first animated control, end to end | [GETTING-STARTED.md](GETTING-STARTED.md) |
| Write scenes: shapes, timelines, states, data, text, components… | [AUTHORING.md](AUTHORING.md) (also `npx anima docs <topic>`) |
| Know which optional features exist and what they cost | [FEATURES.md](FEATURES.md) |
| Put scenes on a web page, script and theme them | [WEB.md](WEB.md) |
| Edit a scene live with a preview and inspectors | [PLAYGROUND.md](PLAYGROUND.md) |
| Look up the exact format and its rules | [`spec/SPEC.md`](../spec/SPEC.md) (`.ani` JSON) and [`spec/ANIML.md`](../spec/ANIML.md) (AniML markup) |
| Study finished scenes | [`examples/`](../examples/) and `modules/<feature>/examples/` |

## I'm a coding agent

Start with [FOR-AGENTS.md](FOR-AGENTS.md): how to look things up (`anima docs`, `anima schema`),
the validate → sample → render loop, and the JSON output formats. Then use AUTHORING.md through
`npx anima docs <topic>` as you go.

## I want to work on Anima itself

| Goal | Read |
|---|---|
| Repo rules, testing, adding a module or capability | [`AGENTS.md`](../AGENTS.md) |
| How the packages fit together | [ARCHITECTURE.md](ARCHITECTURE.md) |
| How optional modules plug in | [`spec/MODULES.md`](../spec/MODULES.md) |
| What's done and what's next | [PLAN.md](PLAN.md) (milestones), [LOG.md](LOG.md) (one entry per phase), [`WORKLOG.md`](../WORKLOG.md) (current state) |
| Capability coverage against Rive | [`parity/MATRIX.md`](parity/MATRIX.md) |
| Agent-native benchmark results | [benchmarks/agent-native.md](benchmarks/agent-native.md) |
| Review changelogs | [changelog/](changelog/) |
| Background research (Rive runtimes, Glyphy) | [research/](research/) |
| Phase designs and decisions | [`design/`](../design/) |

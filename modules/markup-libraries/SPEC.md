# Local markup libraries

`export="…"` is the selection spelling on library roots and imports; existing `exports`
(root) and `select` (import) remain aliases. A nonempty `export` takes precedence over its alias.

Libraries compile away: runtime documents contain expanded resources and no imports.
`<library name="cards" exports="row Score">` restricts public names. Omitted `exports` exposes
all declarations, preserving existing libraries. `<import src="cards.animl" as="ui" select="row"/>`
imports only selected public names; omitted `select` imports all public names. Unknown selected
names are `unknown-name`, with importing source position, JSON pointer and corrective hint.
Private resources stay available to selected definitions through lexical scope; callers cannot
refer to them through the import alias. Private component definitions remain validated.

A library may ship `<model>` definitions alongside components, colors, glyphs, eases and templates.
Imported model names are made collision-free and references in `data`, `model` and `of` attributes
are rewritten in the library's lexical scope. Model property types/defaults retain the data contract.
Library components using those models are self-contained after compilation. A `<component>` inside
a model is a component-valued property, distinguished from a definition by the absence of `grid`.
Root library instances/enums and cloud dependency management are not added by this change.

For vendoring, an import can retain its local origin:
`<import src="vendor/cards.animl" source="../shared/cards.animl" as="ui"/>`.
Compilation reads only `src`, never `source`. `anima library update icon.animl` reads each explicit
`source` and refreshes its existing vendored `src`; paths are relative to the importing file.
Nested imports are followed at their installed destination. All upstream files are read and
validated as library XML before any destination is written. Conflicting origins are
`library-source`; schemes and protocol-relative paths are `library-local-only`. Both carry a
pointer, message and hint. No network access is attempted. `--check` reports staleness and exits 1
without writing; a current tree exits 0. JSON output lists source, destination and change state.

The lexical expansion choice follows [graph research](../../docs/research/rive-format-and-graph.md)
§6. Native library-service workflows are outside the authorized local CLI command set; they have
not been executed or represented as successful parity evidence.

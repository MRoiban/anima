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
Libraries also ship root `<enum name="Mood" values="calm busy"/>` declarations and authored
`<instance name="main" model="Person"><set path="score" value="7"/></instance>` data.
These compile to ordinary JSON `data.enums` and `data.instances` alongside `data.models`.
Names are collision-free per import, including repeated imports of the same file. The `enum`
attribute and named-instance expressions (`$ui:main:score`) resolve in lexical scope; enum member
keys and instance property values remain unchanged. Export selection applies to all three data
kinds. Private dependencies are compiled but cannot be addressed through the public alias.
Default-instance flags retain the data contract (at most one default per document); importing
two defaults is an error, not an implicit choice. Both AniML declarations and expanded JSON use
the existing data diagnostics for invalid members, models and values. Library declaration and
alias failures use `bad-attribute`, `duplicate-name` and `unknown-name`.
Cloud dependency management is outside the local authoring contract.

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
§6. Native library probes require account-touching library commands banned by the project.
Each library oracle therefore records an evidenced skip linked to DESIGN §3; no native
equivalence is claimed.

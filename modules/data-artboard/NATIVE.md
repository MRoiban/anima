# Native comparison limits

The independently captured native probe at
`modules/nested/oracle/property/{scene.rml,commands.txt,session.txt,frames/}`
constructs an artboard property and tries a mid-run assignment. The session records
`err data: card: no property at this path`; the initial and after dumps retain the
nested selection. This evidence predates this ticket; it is reused, not recaptured
or presented as a new successful comparison.

On this ticket, the allowed local CLI queries `schema --search artboard --json`,
`docs --search bindable`, `docs --search 'artboard('`, and
`docs --search 'set-artboard'` confirmed that the schema has artboard property types
and the documented host API obtains assignable values from decoded files. The
last query has no results. The available headless data writer in the recorded probe
rejects this property. Cross-document values require a decoded native file; the
shared brief forbids reading/importing/converting/emitting those files. Consequently
none of the four host-assignment rows has a faithful permitted native command
comparison. Their oracle directories contain explicit evidence-backed skips.

Anima verifies local swaps, fresh animation clocks, repeated data contexts, external
lexical document references and SVG/canvas rendering independently. No native source,
native documentation text, binary file, watermark, thresholds or oracle findings
were copied or changed. These skips do not claim that native runtimes lack bindable
artboards; they describe the permitted comparison path.

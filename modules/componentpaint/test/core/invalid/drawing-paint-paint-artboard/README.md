# Invalid paint sources

bad-source.json must emit unknown-component at /nodes/0/fill/paint with a message and hint.
The sibling core suite also covers malformed source, competing flat fill, undeclared module
and cyclic source graphs. Existing base/paint diagnostics are not removed or downgraded.

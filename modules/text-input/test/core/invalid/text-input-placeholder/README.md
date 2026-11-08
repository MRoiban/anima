Invalid field configurations are created from the minimal fixture in modules/text-input/test/core/field.test.ts: missing peers, invalid runs, empty/non-fixed boxes, duplicate semantics, invalid writable targets, limits and multiline password rejection. Every semantic diagnostic asserts code, JSON pointer, message and hint.

P6-11: `test/core/text-input-placeholder.test.ts` also checks the exact placeholderColor JSON
pointer for non-string and malformed solid paint values. No CSS declarations or URL paint
strings are accepted. Both JSON and AniML spellings round trip in the same test file.

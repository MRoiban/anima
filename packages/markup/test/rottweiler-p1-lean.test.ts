// Only the lean browser compiler: the full entry registers the libraries compiler.
import { expect, it } from 'vitest';
import { compile } from '../src/browser.ts';

// Rottweiler P1 R3-07: words in a comment or attribute do not require the libraries compiler.
it('compiles a comment that mentions <import> without the libraries compiler', () => {
  const r = compile(
    '<anima version="0.1" name="probe" grid="20"><!-- docs mention <import> --><circle id="d" cx="10" cy="10" r="5" fill="#000"/></anima>',
  );
  expect(r.diagnostics).toEqual([]);
  expect(
    compile('<anima version="0.1" name="probe" grid="20"><import src="x.animl"/></anima>')
      .diagnostics[0]?.code,
  ).toBe('markup-libraries-unavailable');
});

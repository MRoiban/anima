import { describe, expect, it } from 'vitest';
import { compile } from '../../../../packages/markup/src/index.ts';

// Handwritten values and source positions guard the shared decoder removal, including UTF-16.
describe('animation text source spans', () => {
  it.each(['&#x1F680;', '&#128640;', '🚀', '&amp;', '&quot;'])(
    '%s keeps later token positions',
    (entity) => {
      const encoded = entity === '&quot;' ? '\\&quot;' : entity;
      const value = entity === '&quot;' ? '"' : entity === '&amp;' ? '&' : '🚀';
      const source = `<anima version="0.1" name="positions" grid="8">
  <circle id="dot" cx="4" cy="4" r="1"/>
  <timeline name="t" duration="1"><track target="dot.rotate">0 &quot;${encoded}&quot; hold; <!-- span --> 1 &quot;end&quot;</track></timeline>
</anima>`;
      const result = compile(source, { validate: false });
      expect(result.diagnostics).toEqual([]);
      const tracks = (result.doc!.timelines as Record<string, { tracks: Record<string, unknown> }>)
        .t!.tracks;
      expect(tracks['dot.rotate']).toEqual([
        [0, value, 'hold'],
        [1, 'end'],
      ]);
      for (const [pointer, needle] of [
        ['/0/1', '&quot;' + encoded],
        ['/1/0', '1 &quot;end'],
        ['/1/1', '&quot;end'],
      ] as const) {
        const offset = source.indexOf(needle);
        const lines = source.slice(0, offset).split('\n');
        expect(result.map.get('/timelines/t/tracks/dot.rotate' + pointer)).toEqual({
          offset,
          line: lines.length,
          col: lines.at(-1)!.length + 1,
        });
      }
    },
  );
});

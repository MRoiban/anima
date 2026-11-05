import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatMarkup, parseXml, type Element } from '../src/index.ts';
const bell = readFileSync(new URL('../../../examples/bell.animl', import.meta.url), 'utf8');
const comments = (source: string) => {
  const { doc } = parseXml(source);
  const found = doc.outer.map((c) => c.value);
  const walk = (el: Element) => {
    for (const c of el.children) {
      if (c.kind === 'comment') found.push(c.value);
      else if (c.kind === 'element') walk(c);
    }
  };
  walk(doc.root!);
  return found;
};

describe('formatMarkup', () => {
  it('is idempotent on bell and preserves every comment, value and element order', () => {
    const result = formatMarkup(bell);
    expect(result.diagnostics).toEqual([]);
    expect(formatMarkup(result.text!).text).toBe(result.text);
    expect(comments(result.text!)).toEqual(comments(bell));
    const shape = (e: Element): unknown => ({
      name: e.name,
      attrs: Object.fromEntries(e.attrs.map((a) => [a.name, a.value])),
      children: e.children
        .filter((c) => c.kind !== 'text' || c.value.trim())
        .map((c) =>
          c.kind === 'element'
            ? shape(c)
            : c.kind === 'comment'
              ? { comment: c.value }
              : { text: c.value.trim().replace(/\s+/g, ' ') },
        ),
    });
    expect(shape(parseXml(result.text!).doc.root!)).toEqual(shape(parseXml(bell).doc.root!));
  });
  it('fixes indentation, attribute order and ragged multiline tracks', () => {
    const messy = `<anima grid='20' name='dot' version='0.1'>
<circle r='2' cy='10' id='dot' cx='10' fill='#fff'/>


<timeline duration='1' name='go'><track target='dot.r'>
0 2 in
 0.25    10 linear
1 3
</track></timeline></anima>`;
    const expected = `<anima version="0.1" name="dot" grid="20">
  <circle id="dot" cx="10" cy="10" r="2" fill="#fff"/>

  <timeline name="go" duration="1">
    <track target="dot.r">
      0     2   in
      0.25  10  linear
      1     3
    </track>
  </timeline>
</anima>
`;
    expect(formatMarkup(messy).text).toBe(expected);
    expect(formatMarkup(expected).text).toBe(expected);
  });
  it('keeps named eases, inline tracks, unknown attributes and comments in place', () => {
    const source = `<anima grid='20' name='x' version='0.1' z='1' a='2'><!--before--><ease curve='cubic(0.2, 0, 0.3, 1)' name='sway'/><!--between--><timeline name='go' duration='1'><track target='x.r'> 0   1  sway;  1  2 </track><!--after track--></timeline></anima><!--end-->`;
    const text = formatMarkup(source).text!;
    expect(text).toContain('<ease name="sway" curve="cubic(0.2, 0, 0.3, 1)"/>');
    expect(text).toContain('<track target="x.r">0 1 sway; 1 2</track>');
    expect(text).toContain('grid="20" z="1" a="2"');
    expect(comments(text)).toEqual(comments(source));
    expect(formatMarkup(text).text).toBe(text);
  });
  it('preserves attribute values without interpreting or normalising their contents', () => {
    const text = formatMarkup(
      `<anima name='x' version='0.1' grid='2e1' title=' a  &amp; &quot;b&quot; '><on when='x&lt;1 &amp;&amp; y' to='s'/></anima>`,
    ).text!;
    expect(text).toContain('grid="2e1"');
    expect(text).toContain('title=" a  &amp; &quot;b&quot; "');
    expect(text).toContain('when="x&lt;1 &amp;&amp; y"');
  });
  it('keeps comments between keyframes in place in both track styles', () => {
    for (const body of [
      '0 1 sway;<!--between-->0.25 20; 1 3',
      '0 1 sway;<!--between-->0.25 20',
      '0 1 sway\n<!--between-->\n0.25 20\n1 3',
    ]) {
      const source = `<anima><timeline><track target="x.r">${body}</track></timeline></anima>`;
      const text = formatMarkup(source).text!;
      expect(comments(text)).toEqual(['between']);
      expect(text.indexOf('0')).toBeLessThan(text.indexOf('<!--between-->'));
      expect(text.indexOf('<!--between-->')).toBeLessThan(text.indexOf('0.25'));
      expect(text.includes(';')).toBe(body.includes(';'));
      expect(formatMarkup(text).text).toBe(text);
    }
  });
  it('is idempotent for multiline metadata with comments', () => {
    const source = '<anima><meta><!--note-->{\n  "a": [1, 2]\n}</meta></anima>';
    const text = formatMarkup(source).text!;
    expect(formatMarkup(text).text).toBe(text);
  });
  it('reports markup-syntax with the parser position, without text', () => {
    const result = formatMarkup('<anima>\n  <group>\n</anima>');
    expect(result.text).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        code: 'markup-syntax',
        severity: 'error',
        pointer: '',
        message: '</anima> closes <group> (opened at line 2)',
        line: 3,
        column: 1,
      },
    ]);
  });
  it('contains the parser RangeError for out-of-range numeric character references', () => {
    const result = formatMarkup('<anima\n title="&#x110000;"/>');
    expect(result.text).toBeUndefined();
    expect(result.diagnostics[0]).toMatchObject({ code: 'markup-syntax', line: 2, column: 9 });
  });
  it('never throws on any prefix of bell', () => {
    for (let i = 0; i <= bell.length; i++)
      expect(() => formatMarkup(bell.slice(0, i))).not.toThrow();
  });
});

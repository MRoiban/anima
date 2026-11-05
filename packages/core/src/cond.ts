// Transition conditions (spec §8): term ("&&" term)*.

export type Op = '==' | '!=' | '<' | '<=' | '>' | '>=';

export type Term =
  | { k: 'is'; name: string; not: boolean }
  | { k: 'cmp'; name: string; op: Op; value: number }
  | { k: 'end' }
  | { k: 'after'; s: number };

const NAME = '([a-z][a-zA-Z0-9-]*)';
const NUM = '(-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?)';
const IS = new RegExp(`^(!?)\\s*${NAME}$`);
const CMP = new RegExp(`^${NAME}\\s*(==|!=|<=|>=|<|>)\\s*${NUM}$`);
const AFTER = new RegExp(`^@after\\(\\s*${NUM}\\s*\\)$`);

/** Parse a condition. Returns its terms, or an error message. */
export function parseCondition(src: string): Term[] | string {
  const terms: Term[] = [];
  for (const raw of src.split('&&')) {
    const t = raw.trim();
    let m: RegExpExecArray | null;
    if (t === '@end') terms.push({ k: 'end' });
    else if ((m = AFTER.exec(t))) {
      const s = Number(m[1]);
      if (s < 0) return '@after needs a time ≥ 0';
      terms.push({ k: 'after', s });
    } else if ((m = IS.exec(t))) terms.push({ k: 'is', name: m[2]!, not: m[1] === '!' });
    else if ((m = CMP.exec(t)))
      terms.push({ k: 'cmp', name: m[1]!, op: m[2] as Op, value: Number(m[3]) });
    else return t ? `cannot read "${t}"` : 'empty term';
  }
  return terms;
}

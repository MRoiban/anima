export const ALIASES: Readonly<Record<string, string>> = {
  check: 'validate',
  lint: 'validate',
  show: 'render',
  draw: 'render',
  find: 'search',
  grep: 'search',
  topics: 'docs',
};

export function resolveAlias(word: string): string | undefined {
  return ALIASES[word];
}

function compact(word: string): string {
  return word.replace(/^--?/, '').toLowerCase();
}

function distance(source: string, target: string): number {
  const a = compact(source);
  const b = compact(target);
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i]![0] = i;
  for (let j = 0; j <= b.length; j++) rows[0]![j] = j * 1.5;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1.5;
      let best = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1.5,
        rows[i - 1]![j - 1]! + substitution,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        best = Math.min(best, rows[i - 2]![j - 2]!);
      rows[i]![j] = best;
    }
  }
  return rows[a.length]![b.length]!;
}

function cutoff(word: string): number {
  const n = compact(word).length;
  if (n <= 2) return 0.75;
  if (n <= 4) return 1.6;
  return Math.min(3.25, 1.1 + n * 0.3);
}

export function suggest(word: string, candidates: readonly string[]): string[] {
  const alias = resolveAlias(compact(word));
  if (alias && candidates.includes(alias)) return [alias];
  const needle = compact(word);
  const ranked = candidates
    .map((candidate) => {
      const name = compact(candidate);
      const prefix = name.startsWith(needle) || needle.startsWith(name);
      return { candidate, prefix, score: distance(word, candidate) };
    })
    .filter(({ score, prefix }) => prefix || score <= cutoff(word))
    .sort(
      (a, b) =>
        Number(b.prefix) - Number(a.prefix) ||
        a.score - b.score ||
        a.candidate.localeCompare(b.candidate),
    );
  if (!ranked.length) return [];
  const best = ranked[0]!.score;
  return ranked
    .filter(({ prefix, score }) => prefix || score <= best + 0.75)
    .slice(0, 3)
    .map(({ candidate }) => candidate);
}

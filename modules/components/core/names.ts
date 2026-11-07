/** Runtime lookup for compiled library names; exact keys preserve old generated documents. */
export function componentNames(doc: Record<string, unknown>, name: string): string[] {
  const definitions = (doc.components ?? {}) as Record<string, unknown>;
  if (Object.hasOwn(definitions, name) && name !== '$comment') return [name];
  const aliases =
    (doc.meta as { componentNames?: Record<string, string> } | undefined)?.componentNames ?? {};
  if (Object.hasOwn(aliases, name) && Object.hasOwn(definitions, aliases[name]!))
    return [aliases[name]!];
  const original = name.replace(/^import-\d+-/, '');
  return Object.keys(definitions).filter(
    (key) =>
      key !== '$comment' &&
      (key.split(':').at(-1) === original || key.replace(/^import-\d+-/, '') === original),
  );
}

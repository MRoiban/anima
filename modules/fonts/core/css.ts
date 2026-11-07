/** Structural subset of text's FontSpec; no text runtime dependency. */
export interface FontStyle {
  family: string;
  size: number;
  weight: number;
  style: 'normal' | 'italic';
  axes?: Record<string, number>;
  features?: Record<string, number>;
  tracking: number;
}
export function cssFont(spec: FontStyle) {
  const tags = (values?: Record<string, number>) =>
    Object.entries(values ?? {})
      .map(([tag, value]) => `${JSON.stringify(tag)} ${value}`)
      .join(', ') || 'normal';
  return {
    font: `${spec.style} ${spec.weight} ${spec.size}px ${spec.family}`,
    fontFamily: spec.family,
    fontSize: `${spec.size}px`,
    fontWeight: String(spec.weight),
    fontStyle: spec.style,
    letterSpacing: `${spec.tracking}px`,
    fontVariationSettings: tags(spec.axes),
    fontFeatureSettings: tags(spec.features),
  };
}

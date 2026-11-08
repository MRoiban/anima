import type { Compiled, Property } from '../../data/core/types.ts';

/** Structural compatibility ignores defaults and document-local component/style names. */
export function compatible(
  target: Compiled,
  source: Compiled | undefined,
  placement?: string,
  path?: string,
): boolean {
  const expected =
    (path && target.refs.get(path)?.property.model) ||
    target.document.instances?.[
      placement ? placement.replace(/^\$/, '').replace(/:$/, '') : target.defaultName
    ]?.model;
  if (!source) return !expected;
  const actual = source.document.instances?.[source.defaultName]?.model;
  const seen = new Set<string>();
  const model = (a?: string, b?: string): boolean => {
    if (!a || !b) return a === b;
    const key = a + ':' + b;
    if (seen.has(key)) return true;
    seen.add(key);
    const left = target.document.models[a]?.properties,
      right = source.document.models[b]?.properties;
    return (
      !!left &&
      !!right &&
      Object.entries(right).every(
        ([key, p]) => key === '$comment' || (!!left[key] && property(left[key], p)),
      )
    );
  };
  const property = (a: Property, b: Property): boolean =>
    a.type === b.type &&
    a.assetType === b.assetType &&
    a.min === b.min &&
    a.max === b.max &&
    (b.type !== 'enum' ||
      JSON.stringify(a.values?.slice().sort()) === JSON.stringify(b.values?.slice().sort())) &&
    (b.type !== 'model-ref' || model(a.model, b.model)) &&
    (b.type !== 'list' || model(a.of, b.of));
  if (!model(expected, actual)) return false;
  // bindData also shares matching named instances, not only the selected default.
  for (const [name, instance] of Object.entries(source.document.instances ?? {})) {
    const targetInstance = target.document.instances?.[name];
    if (
      name !== source.defaultName &&
      targetInstance &&
      (source.model.inheritedData || target.document.models[instance.model]?.global) &&
      !model(targetInstance.model, instance.model)
    )
      return false;
  }
  return true;
}

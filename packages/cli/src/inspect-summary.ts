import { ptr, type Diagnostic, type Model } from '@anima-format/core';
export function wiringSummary(model: Model, diagnostics: Diagnostic[] = []) {
  const doc = model.doc;
  const own = <T>(value: Record<string, T> | undefined): [string, T][] =>
    Object.entries(value ?? {}).filter(([key]) => key !== '$comment');
  const findings: { code: string; pointer: string; message: string; hint: string }[] = [];
  const add = (code: string, pointer: string, message: string, hint: string) =>
    findings.push({ code, pointer, message, hint });
  for (const d of diagnostics)
    if (d.code === 'unused-input')
      add(
        'unbound-input',
        d.pointer,
        d.message,
        'bind the input, use it in a condition/listener, or remove it',
      );
  const instanced = new Set<string>();
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const [key, v] of own(value as Record<string, unknown>)) {
      if (key === 'component') {
        if (typeof v === 'string') instanced.add(v);
        else if (v && typeof v === 'object')
          Object.values(v).forEach((n) => {
            if (typeof n === 'string') instanced.add(n);
          });
      }
      walk(v);
    }
  };
  walk(doc);
  for (const name of own(doc.components).map(([name]) => name))
    if (!instanced.has(name))
      add(
        'unused-component',
        ptr('/components', name),
        'component is never instanced: ' + name,
        'add an instance or remove the declaration',
      );
  const machines = [
    ['/machine', doc.machine],
    ...own(doc.machines).map(([name, machine]) => [ptr('/machines', name), machine]),
  ] as [string, typeof doc.machine][];
  for (const [machinePath, machine] of machines)
    for (const [name, layer] of own(
      (machine?.layers ?? {}) as Record<
        string,
        { initial: string; states: Record<string, { kind?: string; on?: { to: string }[] }> }
      >,
    )) {
      const reached = new Set<string>([layer.initial]);
      const states = own(layer.states);
      for (const [n, s] of states) if (s.kind === 'any') reached.add(n);
      let changed = true;
      while (changed) {
        changed = false;
        for (const [n, s] of states)
          if (reached.has(n))
            for (const t of s.on ?? [])
              if (!reached.has(t.to)) {
                reached.add(t.to);
                changed = true;
              }
      }
      for (const [n] of states)
        if (!reached.has(n))
          add(
            'unreachable-state',
            ptr(ptr(machinePath + '/layers', name) + '/states', n),
            'state is unreachable: ' + n,
            'add a transition from a reachable state',
          );
    }
  const data = doc.data as import('../../../modules/data/core/types.ts').DataDocument | undefined;
  const models = Object.fromEntries(own(data?.models));
  const instances = Object.fromEntries(own(data?.instances));
  const defaultModel =
    data?.model ??
    Object.values(instances).find((instance) => instance.default)?.model ??
    Object.values(instances)[0]?.model ??
    Object.keys(models)[0];
  const usedModels = new Set<string>([
    ...(defaultModel ? [defaultModel] : []),
    ...Object.values(instances).map((instance) => instance.model),
  ]);
  const usedProperties = new Set<string>();
  const componentParents = new Map<string, Set<string>>();
  const collectComponentParents = (value: unknown, context = defaultModel): void => {
    if (Array.isArray(value)) {
      value.forEach((child) => collectComponentParents(child, context));
      return;
    }
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    if (typeof object.data === 'string' && models[object.data]) context = object.data;
    const component = object.component;
    const names =
      typeof component === 'string'
        ? [component]
        : component && typeof component === 'object'
          ? Object.values(component).filter((name): name is string => typeof name === 'string')
          : [];
    if (context)
      for (const name of names) {
        const parents = componentParents.get(name) ?? new Set<string>();
        parents.add(context);
        componentParents.set(name, parents);
      }
    for (const [key, child] of own(object)) {
      if (key === 'data' && typeof child === 'object') continue;
      collectComponentParents(child, context);
    }
  };
  collectComponentParents(doc);
  const markPath = (path: string, context = defaultModel): void => {
    const [instance, relative] = path.includes(':')
      ? path.slice(1).split(':')
      : [undefined, path.slice(1)];
    let model: string | undefined = instance ? instances[instance]?.model : context;
    for (const key of relative?.split('.') ?? []) {
      if (!model || /^\d+$/.test(key)) continue;
      const property: import('../../../modules/data/core/types.ts').Property | undefined =
        models[model]?.properties[key];
      if (!property) break;
      usedModels.add(model);
      usedProperties.add(model + ':' + key);
      if (property.type === 'model-ref' || property.type === 'list')
        model = property.model ?? property.of;
      else break;
    }
  };
  const scan = (value: unknown, context = defaultModel, parents?: Set<string>): void => {
    if (typeof value === 'string') {
      for (const path of value.match(/\$[A-Za-z][\w-]*(?::[A-Za-z][\w-]*)?(?:\.[\w-]+)*/g) ?? []) {
        if (path.startsWith('$parent.') && parents?.size)
          for (const parent of parents) markPath('$' + path.slice('$parent.'.length), parent);
        else markPath(path, context);
      }
    } else if (Array.isArray(value)) value.forEach((v) => scan(v, context, parents));
    else if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      if (typeof object.data === 'string' && models[object.data]) {
        context = object.data;
        usedModels.add(context);
      }
      for (const [key, child] of own(object)) {
        if (key === 'data' && typeof child === 'object') continue;
        scan(key, context, parents);
        if (key === 'components' && child && typeof child === 'object') {
          for (const [name, definition] of own(child as Record<string, unknown>)) {
            const component = definition as Record<string, unknown>;
            const componentContext =
              typeof component.data === 'string' && models[component.data]
                ? component.data
                : context;
            scan(component, componentContext, componentParents.get(name));
          }
        } else scan(child, context, parents);
      }
    }
  };
  scan(doc);
  // Computed properties and converter options are reads too. Scan definitions in their own model.
  for (const [name, definition] of Object.entries(models)) scan(definition.properties, name);
  let growing = true;
  while (growing) {
    growing = false;
    for (const name of [...usedModels])
      for (const property of Object.values(models[name]?.properties ?? {})) {
        const child = property.model ?? property.of;
        if (child && models[child] && !usedModels.has(child)) {
          usedModels.add(child);
          growing = true;
        }
      }
  }
  for (const [name, m] of Object.entries(models)) {
    if (!usedModels.has(name))
      add(
        'unused-model',
        ptr('/data/models', name),
        'model is unused: ' + name,
        'select this model or remove it',
      );
    for (const prop of own(m.properties).map(([name]) => name))
      if (!usedProperties.has(name + ':' + prop))
        add(
          'unused-property',
          ptr(ptr('/data/models', name) + '/properties', prop),
          'property is unused: ' + prop,
          'bind the property or remove it',
        );
  }
  for (const [i, l] of (doc.listeners ?? []).entries())
    if ('target' in l && !model.nodes.some((n) => n.id === l.target))
      add(
        'listener-target',
        '/listeners/' + i + '/target',
        'listener target does not exist',
        'choose a node id',
      );
  return findings;
}

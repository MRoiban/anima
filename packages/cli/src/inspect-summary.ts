import { ptr, type Diagnostic, type Model } from '@anima-format/core';
export function wiringSummary(model: Model, diagnostics: Diagnostic[] = []) {
  const doc = model.doc;
  const findings: { code: string; pointer: string; message: string; hint: string }[] = [];
  const add = (code: string, pointer: string, message: string, hint: string) =>
    findings.push({ code, pointer, message, hint });
  const text = JSON.stringify({
    ...doc,
    inputs: undefined,
    data: undefined,
    components: undefined,
  });
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
    for (const [key, v] of Object.entries(value)) {
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
  for (const name of Object.keys(doc.components ?? {}))
    if (!instanced.has(name))
      add(
        'unused-component',
        ptr('/components', name),
        'component is never instanced: ' + name,
        'add an instance or remove the declaration',
      );
  for (const [name, layer] of Object.entries(
    doc.machine.layers as Record<
      string,
      { initial: string; states: Record<string, { kind?: string; on?: { to: string }[] }> }
    >,
  )) {
    const reached = new Set<string>([layer.initial]);
    const states = Object.entries(layer.states);
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
          ptr(ptr('/machine/layers', name) + '/states', n),
          'state is unreachable: ' + n,
          'add a transition from a reachable state',
        );
  }
  const data = doc.data as
    | { models?: Record<string, { properties?: Record<string, unknown> }>; model?: string }
    | undefined;
  for (const [name, m] of Object.entries(data?.models ?? {})) {
    if (data?.model !== name && !text.includes(JSON.stringify(name)))
      add(
        'unused-model',
        '/data/models/' + name,
        'model is unused: ' + name,
        'select this model or remove it',
      );
    for (const prop of Object.keys(m.properties ?? {}))
      if (!text.includes('$' + prop))
        add(
          'unused-property',
          '/data/models/' + name + '/properties/' + prop,
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

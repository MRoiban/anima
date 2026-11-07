import type { Compiler, Form } from '../../../packages/markup/src/compile.ts';
import type { Element } from '../../../packages/markup/src/xml.ts';
import type { LayoutElement } from '../../../packages/markup/src/layout.ts';
type Obj = Record<string, unknown>;
export const motionMarkup = {
  form(el: Element, base: Form): Form {
    if (el.name === 'track') return { ...base, children: ['key'] };
    if (el.name === 'key')
      return { attrs: { t: 'number', value: 'value', ease: 'ease' }, required: ['t', 'value'] };
    if (el.name === 'channel')
      return {
        attrs: { name: 'name', type: 'string', value: 'value' },
        required: ['name', 'type', 'value'],
      };
    if (el.name === 'machine')
      return { attrs: { name: 'name' }, required: ['name'], children: ['layer'] };
    if (el.name === 'timeline')
      return { ...base, attrs: { ...base.attrs, speed: 'number', quantize: 'number', work: 2 } };
    if (el.name === 'state')
      return { ...base, attrs: { ...base.attrs, hold: 'boolean', time: 'string' } };
    if (el.name === 'on')
      return {
        ...base,
        attrs: {
          ...base.attrs,
          exit: 'number',
          exitFraction: 'number',
          sync: 'boolean',
          exitNext: 'string',
        },
      };
    if (el.name === 'anima' || el.name === 'component')
      return { ...base, children: [...base.children!, 'machine'] };
    return { ...base, children: [...(base.children ?? []), 'channel'] };
  },
  keyValue(source: string): string | undefined {
    return source.startsWith('$') ? source : undefined;
  },
  frames(c: Compiler, el: Element, children: Element[], p: string): unknown[][] | undefined {
    if (!children.length) return;
    if (el.children.some((child) => child.kind === 'text' && child.value.trim()))
      c.error(
        'bad-keyframe',
        p,
        el.at,
        'cannot mix key elements and track text',
        'use one keyframe spelling per track',
      );
    return children.map((key, i) => {
      const at = p + '/' + i,
        a = c.attrs(key, at);
      c.children(key, at);
      c.map.set(at, key.at);
      for (const [name, index] of [
        ['t', 0],
        ['value', 1],
        ['ease', 2],
      ] as const)
        if (a.has(name)) c.map.set(at + '/' + index, a.get(name)!.valueAt);
      const value = [
        a.has('t') ? c.read(a.get('t')!, 'number', at + '/0') : 0,
        a.has('value')
          ? c.read(
              a.get('value')!,
              a.get('value')!.value.trim().startsWith('$') ? 'string' : 'value',
              at + '/1',
            )
          : 0,
      ];
      if (a.has('ease')) value.push(c.read(a.get('ease')!, 'ease', at + '/2'));
      return value;
    });
  },
  node(c: Compiler, el: Element, children: Element[], o: Obj, p: string): void {
    for (const child of children.filter((x) => x.name === 'channel')) {
      const a = c.attrs(child, p + '/channels');
      c.children(child, p + '/channels');
      const name = a.get('name')?.value ?? '',
        cp = p + '/channels/' + name;
      const channels = c.container(o, 'channels', p, child.at);
      if (Object.hasOwn(channels, name)) {
        c.error('duplicate-name', cp, child.at, 'duplicate channel', 'use a unique channel name');
        continue;
      }
      channels[name] = {
        type: a.get('type')?.value,
        value: a.has('value') ? c.read(a.get('value')!, 'value', cp + '/value') : undefined,
      };
    }
    void el;
  },
  rootChild(c: Compiler, el: Element, o: Obj, p: string): boolean {
    if (el.name !== 'machine') return false;
    const a = c.attrs(el, p + '/machines'),
      name = a.get('name')?.value ?? '';
    const machines = c.container(o, 'machines', p, el.at),
      layers: Obj = {};
    if (Object.hasOwn(machines, name))
      c.error(
        'duplicate-name',
        p + '/machines/' + name,
        el.at,
        'duplicate machine',
        'use a unique name',
      );
    for (const child of c.children(el, p + '/machines/' + name)) {
      const ln = child.attrs.find((a) => a.name === 'name');
      c.addNamed(
        layers,
        ln?.value ?? '',
        child,
        p + '/machines/' + name + '/layers',
        ln?.valueAt ?? child.at,
      );
    }
    machines[name] = { layers };
    return true;
  },
  channels(n: Obj): LayoutElement[] {
    return Object.entries((n.channels ?? {}) as Record<string, { type: string; value: unknown }>)
      .filter(([n]) => n !== '$comment')
      .map(([name, c]) => ({
        name: 'channel',
        attrs: [
          ['name', name],
          ['type', c.type],
          ['value', typeof c.value === 'string' ? JSON.stringify(c.value) : String(c.value)],
        ],
        children: [],
      }));
  },
};

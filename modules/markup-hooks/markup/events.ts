import type { Compiler, Form } from '../../../packages/markup/src/compile.ts';
import type { Element } from '../../../packages/markup/src/xml.ts';
export const eventsMarkup = {
  form(el: Element, base: Form): Form {
    if (el.name === 'state') return { ...base, attrs: { ...base.attrs, endEmit: 'name' } };
    if (el.name === 'on')
      return { ...base, attrs: { ...base.attrs, startEmit: 'name', endEmit: 'name' } };
    if (el.name === 'audio-volume')
      return { attrs: { asset: 'name', value: 'number' }, required: ['asset', 'value'] };
    if (el.name === 'event-def')
      return {
        attrs: {
          name: 'name',
          payload: 'string',
          url: 'string',
          target: 'string',
          audio: 'string',
          volume: 'number',
        },
        required: ['name'],
      };
    if (el.name === 'anima' || el.name === 'component')
      return { ...base, children: [...base.children!, 'event-def', 'audio-volume'] };
    return base;
  },
  rootChild(c: Compiler, el: Element, o: Record<string, unknown>, p: string): boolean {
    if (el.name === 'audio-volume') {
      const a = c.attrs(el, p + '/audioVolumes');
      c.children(el, p + '/audioVolumes');
      if (!a.has('value')) return true;
      const name = a.get('asset')?.value ?? '';
      const volumes = c.container(o, 'audioVolumes', p, el.at);
      if (Object.hasOwn(volumes, name))
        c.error(
          'duplicate-name',
          p + '/audioVolumes/' + name,
          el.at,
          'duplicate audio volume',
          'use one volume per asset',
        );
      volumes[name] = c.read(a.get('value')!, 'number', p + '/audioVolumes/' + name);
      return true;
    }
    if (el.name !== 'event-def') return false;
    const a = c.attrs(el, p + '/eventDefs');
    c.children(el, p + '/eventDefs');
    const name = a.get('name')?.value ?? '';
    const defs = c.container(o, 'eventDefs', p, el.at);
    if (Object.hasOwn(defs, name))
      c.error(
        'duplicate-name',
        p + '/eventDefs/' + name,
        el.at,
        'duplicate event definition',
        'use a unique name',
      );
    const def: Record<string, unknown> = {};
    for (const [k, v] of a)
      if (k !== 'name') {
        if (k === 'payload') {
          try {
            def[k] = JSON.parse(v.value);
          } catch {
            c.error(
              'event-payload',
              p + '/eventDefs/' + name + '/payload',
              v.valueAt,
              'payload must be a JSON object',
              'use a JSON object of typed fields',
            );
          }
        } else
          def[k] = c.read(
            v,
            k === 'volume' ? 'number' : 'string',
            p + '/eventDefs/' + name + '/' + k,
          );
      }
    defs[name] = def;
    return true;
  },
};

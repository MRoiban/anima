import { ptr } from '@anima-format/core';
import type { Compiler } from './compile.ts';
import type { Element, Attr } from './xml.ts';
export const bindMarkup = {
  build(a: Map<string, Attr>): string {
    return a.get('value')?.value ?? '';
  },
  rootChild(compiler: Compiler, c: Element, o: Record<string, unknown>, p: string): boolean {
    if (c.name === 'bind') {
      const target = c.attrs.find((a) => a.name === 'target');
      const value = c.attrs.find((a) => a.name === 'value');
      const map = compiler.container(o, 'bind', p, c.at);
      const key = compiler.address(target?.value.trim() ?? '');
      compiler.addNamed(map, key, c, p + '/bind', target?.valueAt ?? c.at);
      compiler.map.set(ptr(p + '/bind', key), value?.valueAt ?? c.at);
      return true;
    }
    return false;
  },
};

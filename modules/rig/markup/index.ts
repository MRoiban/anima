import type { Compiler } from '../../../packages/markup/src/compile.ts';
import type { Element } from '../../../packages/markup/src/xml.ts';
// Text's generic reader handles these arrays too; this smaller reader needs only rig forms.
export const rigMarkup = {
  node(c: Compiler, _e: Element, children: Element[], o: Record<string, unknown>, p: string) {
    return children.filter((child) => {
      if (!c.elements[child.name]?.values?.kind) return true;
      const list = (o.constraints ??= []) as unknown[];
      list.push(c.build(child, p + '/constraints/' + list.length));
      return false;
    });
  },
};

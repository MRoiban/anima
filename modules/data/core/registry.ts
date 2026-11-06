import type { ObjShape, Shape } from '../../../packages/core/src/registry.ts';
const string: Shape = { k: 'str' };
const bool: Shape = { k: 'bool' };
const number: Shape = { k: 'num' };
const any: Shape = { k: 'any' };
const property: ObjShape = {
  k: 'obj',
  req: ['type'],
  p: {
    type: {
      k: 'str',
      of: [
        'number',
        'string',
        'bool',
        'color',
        'trigger',
        'enum',
        'list',
        'model-ref',
        'asset-ref',
      ],
    },
    default: any,
    min: number,
    max: number,
    values: { k: 'arr', of: string },
    enum: string,
    system: string,
    of: string,
    model: string,
    assetType: { k: 'str', of: ['image', 'font', 'blob'], markup: 'type' },
    public: bool,
    label: string,
  },
};
export const binding: ObjShape = {
  k: 'obj',
  feature: 'data',
  req: ['value'],
  p: {
    value: string,
    mode: { k: 'str', of: ['to-target', 'to-source', 'two-way', 'once'] },
    prefer: { k: 'str', of: ['source', 'target'] },
    convert: string,
    options: { k: 'map', of: any },
  },
};
export const dataShape: ObjShape = {
  k: 'obj',
  req: ['models'],
  p: {
    models: {
      k: 'map',
      of: {
        k: 'obj',
        req: ['properties'],
        p: { properties: { k: 'map', of: property }, global: bool },
      },
    },
    instances: {
      k: 'map',
      of: {
        k: 'obj',
        req: ['model'],
        p: {
          model: string,
          default: bool,
          exported: bool,
          label: string,
          values: { k: 'map', of: any },
        },
      },
    },
    enums: {
      k: 'map',
      of: {
        k: 'arr',
        min: 1,
        of: {
          k: 'alt',
          of: [string, { k: 'obj', req: ['key'], p: { key: string, label: string } }],
        },
      },
    },
    model: string,
    preview: string,
  },
};
export const propertyShape = property;

// JSON Schema (draft 2020-12) generated from the registry. Tooling only; the runtime does not
// import it. `spec/schema/ani.schema.json` is this function's output and is never hand-edited.

import { DOC, NODE_TYPES, type Shape, nodeShape } from './registry.ts';

type JSONSchema = Record<string, unknown>;

const COMMENT = { $comment: { type: 'string' } };

function toSchema(s: Shape): JSONSchema {
  return {
    // seam(P8-1): module-owned discriminated validation has a precise tooling schema.
    ...shapeSchema(s.schema ?? s),
    ...(s.feature && { feature: s.feature }),
    ...(s.default !== undefined && { default: s.default }),
  };
}

function shapeSchema(s: Shape): JSONSchema {
  switch (s.k) {
    case 'str':
      return {
        type: 'string',
        ...(s.re && { pattern: s.re.source }),
        ...(s.of && { enum: [...s.of] }),
      };
    case 'num':
      return {
        type: s.int ? 'integer' : 'number',
        ...(s.min !== undefined && { minimum: s.min }),
        ...(s.max !== undefined && { maximum: s.max }),
        ...(s.gt !== undefined && { exclusiveMinimum: s.gt }),
      };
    case 'bool':
      return { type: 'boolean' };
    case 'any':
      return {};
    case 'arr':
      return { type: 'array', items: toSchema(s.of), ...(s.min && { minItems: s.min }) };
    case 'tup':
      return {
        type: 'array',
        prefixItems: s.of.map(toSchema),
        items: false,
        minItems: s.min,
        maxItems: s.of.length,
      };
    case 'obj': {
      const properties: JSONSchema = { ...COMMENT };
      for (const [k, v] of Object.entries(s.p)) properties[k] = toSchema(v);
      return {
        type: 'object',
        properties,
        ...(s.req?.length && { required: s.req }),
        additionalProperties: false,
      };
    }
    case 'map':
      return {
        type: 'object',
        properties: COMMENT,
        ...(s.key && { propertyNames: { pattern: `^\\$comment$|${s.key.source}` } }),
        additionalProperties: toSchema(s.of),
      };
    case 'alt':
      return { anyOf: s.of.map(toSchema) };
    case 'node':
      return { $ref: '#/$defs/node' };
  }
}

/** The JSON Schema of a `.ani` document. */
export function jsonSchema(): JSONSchema {
  const root = toSchema(DOC);
  const properties = root.properties as JSONSchema;
  properties.nodes = { ...(properties.nodes as JSONSchema), minItems: 0 };
  root.if = {
    required: ['requires'],
    properties: { requires: { type: 'array', contains: { const: 'components' } } },
  };
  root.else = { properties: { nodes: { type: 'array', minItems: 1 } } };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://github.com/MRoiban/anima/spec/schema/ani.schema.json',
    title: 'Anima document (.ani) 0.1',
    description:
      'Generated from packages/core/src/registry.ts. The loader adds semantic checks (spec §11.3) a schema cannot express.',
    ...root,
    $defs: {
      node: {
        oneOf: NODE_TYPES.map((t) => {
          const s = toSchema(nodeShape(t)) as { properties: JSONSchema };
          s.properties.type = { const: t };
          return s;
        }),
      },
    },
  };
}

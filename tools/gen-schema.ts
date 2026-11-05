import '@anima-format/core/all';
// Writes spec/schema/ani.schema.json from the registry. `npm run gen` runs it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { jsonSchema } from '../packages/core/src/schema.ts';

export const SCHEMA_PATH = new URL('../spec/schema/ani.schema.json', import.meta.url);

export const schemaText = (): string => JSON.stringify(jsonSchema(), null, 2) + '\n';

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(new URL('.', SCHEMA_PATH), { recursive: true });
  writeFileSync(SCHEMA_PATH, schemaText());
  console.log('wrote spec/schema/ani.schema.json');
}

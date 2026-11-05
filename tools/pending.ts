// Tooling-only marker: unfinished probes are pending, never successful evidence.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function pendingReason(directory: string | URL): string | undefined {
  const path = resolve(
    directory instanceof URL ? fileURLToPath(directory) : directory,
    'todo.json',
  );
  if (!existsSync(path)) return;
  const marker = JSON.parse(readFileSync(path, 'utf8'));
  if (marker.status !== 'todo' || typeof marker.reason !== 'string' || !marker.reason.trim())
    throw Error(`${path}: expected {status: "todo", reason: <nonempty string>}`);
  return marker.reason;
}

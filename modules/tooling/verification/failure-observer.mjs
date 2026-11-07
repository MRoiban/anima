import process from 'node:process';
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { existsSync, copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const original = child.execFileSync;
child.execFileSync = function (...args) {
  try {
    return original.apply(this, args);
  } catch (error) {
    if (Array.isArray(args[1]) && args[1].includes('--outputFile=pending-report.json')) {
      const source = join(args[2]?.cwd ?? process.cwd(), 'pending-report.json');
      if (existsSync(source)) copyFileSync(source, '/tmp/p3b2/nested-failed.json');
      writeFileSync(
        '/tmp/p3b2/nested-stdio.txt',
        String(error.stdout ?? '') + '\n' + String(error.stderr ?? ''),
      );
    }
    throw error;
  }
};
syncBuiltinESMExports();

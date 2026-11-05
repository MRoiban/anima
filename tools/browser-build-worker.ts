// Build-web's independent outputs share a bounded worker pool so minification can run in
// parallel. The size gate still uses the same bundle() function and measuring method.
import { parentPort, workerData } from 'node:worker_threads';
import { bundle } from './browser-build.ts';

for (const entry of workerData as string[]) parentPort!.postMessage([entry, await bundle(entry)]);

// Pixel checks against CLI PNGs. pngjs is existing development tooling.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
const dir = new URL('./', import.meta.url);
const read = name => PNG.sync.read(fs.readFileSync(new URL(name, dir)));
const rest = read('rest.png'), hover = read('hover.png'), quarter = read('quarter.png');
let changed = 0, escaped = 0, segments = 0, previous = false;
for (let y = 0; y < rest.height; y++) for (let x = 0; x < rest.width; x++) {
  const i = (y * rest.width + x) * 4;
  const differs = [0,1,2,3].some(c => rest.data[i+c] !== hover.data[i+c]);
  if (differs) {
    changed++;
    if (Math.hypot(x + 0.5 - 160, y + 0.5 - 160) > 129) escaped++;
  }
}
const lit = angle => {
  const x = Math.floor(160 + 128 * Math.cos(angle));
  const y = Math.floor(160 + 128 * Math.sin(angle));
  return rest.data[(y * 320 + x) * 4] < 220;
};
previous = lit(-Math.PI * 2 / 4800);
for (let n = 0; n < 4800; n++) {
  const current = lit(n * Math.PI * 2 / 4800);
  if (current && !previous) segments++;
  previous = current;
}
assert.equal(segments, 24);
assert.ok(changed > 0);
assert.equal(escaped, 0); // One pixel beyond r=128 allowed for edge antialiasing.
const rgb = (png, x, y) => [...png.data.subarray((y*320+x)*4, (y*320+x)*4+3)];
const top = rgb(quarter, 160, 32), right = rgb(quarter, 287, 160);
assert.ok(top[0] > top[1] && right[0] > right[1]); // accent-coloured
assert.ok(right[1] > top[1]); // gradient becomes lighter toward bottom-right
const evidence = {trackDashCount: segments, hoverChangedPixels: changed,
  changedOutsideRadius129: escaped, quarterTop: top, quarterRight: right};
fs.writeFileSync(new URL('pixels.json', dir), JSON.stringify(evidence, null, 2)+'\n');
console.log(evidence);

// Original 8×4 two-colour flag texture. No third-party image content.
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
const image = new PNG({ width: 8, height: 4 });
for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++)
  image.data.set(y < 2 ? [217,119,87,255] : [53,91,111,255], 4*(y*8+x));
writeFileSync(new URL('flag.png', import.meta.url), PNG.sync.write(image));

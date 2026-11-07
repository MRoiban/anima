import { PNG } from 'pngjs';
/** RGBA comparison in output pixel coordinates; tolerance applies independently to each channel. */
export function comparePNG(a: Buffer, b: Buffer, tolerance = 0, diff = false) {
  const left = PNG.sync.read(a),
    right = PNG.sync.read(b);
  if (left.width !== right.width || left.height !== right.height)
    throw new Error('comparison image dimensions do not match');
  return compareRGBA(left.data, right.data, left.width, left.height, tolerance, diff);
}

export function compareRGBA(
  left: Uint8Array,
  right: Uint8Array,
  width: number,
  height: number,
  tolerance = 0,
  diff = false,
) {
  if (left.length !== right.length || left.length !== width * height * 4)
    throw Error('comparison raster dimensions do not match');
  const image = new PNG({ width: width, height: height });
  let differingPixels = 0,
    pixelsBeyondTolerance = 0,
    maxChannelDifference = 0,
    sum = 0;
  for (let i = 0; i < left.length; i += 4) {
    let delta = 0;
    for (let c = 0; c < 4; c++) {
      const d = Math.abs(left[i + c]! - right[i + c]!);
      delta = Math.max(delta, d);
      sum += d;
    }
    if (delta) differingPixels++;
    if (delta > tolerance) pixelsBeyondTolerance++;
    maxChannelDifference = Math.max(maxChannelDifference, delta);
    image.data.set([delta, delta, delta, 255], i);
  }
  return {
    width: width,
    height: height,
    differingPixels,
    pixelsBeyondTolerance,
    maxChannelDifference,
    meanChannelDifference: sum / left.length,
    pass: pixelsBeyondTolerance === 0,
    ...(diff ? { diff: PNG.sync.write(image) } : {}),
  };
}

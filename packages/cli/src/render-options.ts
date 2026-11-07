import { PNG } from 'pngjs';
export function viewportSVG(
  svg: string,
  width: number,
  height: number,
  fit: string,
  scale: number,
): string {
  return svg.replace(/<svg\b([^>]*)>/, (_, raw: string) => {
    let attrs = raw.replace(/\s(?:width|height|preserveAspectRatio)="[^"]*"/g, '');
    if (fit === 'none') {
      const box = /viewBox="([^"]+)"/.exec(attrs)?.[1]?.split(/\s+/).map(Number) ?? [
        0,
        0,
        width,
        height,
      ];
      attrs = attrs.replace(/viewBox="[^"]*"/, `viewBox="${box[0]} ${box[1]} ${width} ${height}"`);
    }
    return `<svg${attrs} width="${Math.max(1, Math.round(width * scale))}" height="${Math.max(1, Math.round(height * scale))}" preserveAspectRatio="${fit === 'fill' || fit === 'none' ? 'none' : fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}">`;
  });
}
export function probePNG(bytes: Buffer, points: string) {
  const image = PNG.sync.read(bytes);
  return points.split(';').map((pair) => {
    if (!/^\d+,\d+$/.test(pair)) throw Error('--probe takes x,y[;x,y…] in output pixels');
    const [x, y] = pair.split(',').map(Number) as [number, number];
    if (x >= image.width || y >= image.height)
      throw Error('--probe point is outside the output image');
    return {
      x,
      y,
      rgba: [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)],
    };
  });
}

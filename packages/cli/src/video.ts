/// <reference lib="dom" />
import { ImageEncoder } from './encode.ts';

/** CLI-only real-time WebM encoding; no browser or codec dependency ships in the runtime. */
export async function encodeVideo(frames: Buffer[], fps: number): Promise<Buffer> {
  const session = new ImageEncoder();
  try {
    const browser = await session.browser();
    const page = await browser.newPage();
    try {
      const encoded = await page.evaluate(
        async ({ frames, fps }) => {
          if (!MediaRecorder.isTypeSupported('video/webm'))
            throw Error('WebM recording unsupported');
          const images = await Promise.all(
            frames.map(async (src) => {
              const img = new Image();
              img.src = 'data:image/png;base64,' + src;
              await img.decode();
              return img;
            }),
          );
          const canvas = document.createElement('canvas');
          canvas.width = images[0]!.width;
          canvas.height = images[0]!.height;
          const ctx = canvas.getContext('2d')!;
          const stream = canvas.captureStream(0);
          const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
          const chunks: Blob[] = [];
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          const done = new Promise<Blob>((resolve, reject) => {
            recorder.ondataavailable = (e) => {
              if (e.data.size) chunks.push(e.data);
            };
            recorder.onerror = () => reject(Error('WebM recording failed'));
            recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
          });
          recorder.start();
          try {
            for (const image of images) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(image, 0, 0);
              track.requestFrame();
              await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
            }
            recorder.stop();
            const blob = await done;
            return await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result).split(',')[1]!);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } finally {
            stream.getTracks().forEach((t) => t.stop());
          }
        },
        { frames: frames.map((f) => f.toString('base64')), fps },
      );
      return Buffer.from(encoded, 'base64');
    } finally {
      await page.close();
    }
  } catch (e) {
    throw Object.assign(Error('WebM encoder unavailable: ' + (e as Error).message), {
      code: 'build-encoder-unavailable',
      pointer: '',
      hint: 'install cached Playwright Chromium or set CHROMIUM_PATH; use --frames with PNG output as a fallback',
    });
  } finally {
    await session.close();
  }
}

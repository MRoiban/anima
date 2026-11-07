/// <reference lib="dom" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Model, AnimaEvent } from '@anima-format/core';
import { eventSource, type CapturedEvent } from '../../core/src/event-capture.ts';
import { ImageEncoder } from './encode.ts';
/** Offline stereo, 48 kHz, signed 16-bit PCM. Events carry absolute player timestamps. */
export async function mixAudio(
  model: Model,
  events: AnimaEvent[],
  duration: number,
  file: string,
): Promise<Buffer> {
  const encoder = new ImageEncoder();
  try {
    const page = await (await encoder.browser()).newPage();
    const clips = events
      .filter((e) => e.audio)
      .map((e) => {
        const scope = (e as CapturedEvent)[eventSource] ?? model;
        const a = scope.doc.assets?.[e.audio!];
        if (!a || a.type !== 'audio') throw Error('cannot resolve audio asset ' + e.audio);
        if (/^[a-z][a-z\d+.-]*:/i.test(a.source) && !a.source.startsWith('data:'))
          throw Error('offline audio requires local or data URI assets');
        const bytes = a.source.startsWith('data:')
          ? Buffer.from(a.source.split(',')[1]!, 'base64')
          : readFileSync(resolve(dirname(file), a.source));
        return {
          bytes: [...bytes],
          time: e.time,
          start: a.start ?? 0,
          end: a.end,
          volume: (e.volume ?? 1) * (scope.doc.audioVolumes?.[e.audio!] ?? 1),
        };
      });
    const channels = await page.evaluate(
      async ({ clips, duration }) => {
        const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * 48000)), 48000);
        for (const clip of clips) {
          const decoded = await ctx.decodeAudioData(new Uint8Array(clip.bytes).buffer);
          const end = clip.end ?? decoded.duration;
          if (clip.start < 0 || end > decoded.duration || end <= clip.start)
            throw Error('invalid audio clip bounds');
          const source = ctx.createBufferSource();
          source.buffer = decoded;
          const gain = ctx.createGain();
          gain.gain.value = clip.volume;
          source.connect(gain);
          gain.connect(ctx.destination);
          source.start(clip.time, clip.start, end - clip.start);
        }
        const mixed = await ctx.startRendering();
        return [Array.from(mixed.getChannelData(0)), Array.from(mixed.getChannelData(1))];
      },
      { clips, duration },
    );
    const n = channels[0]!.length,
      wav = Buffer.alloc(44 + n * 4);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(36 + n * 4, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(2, 22);
    wav.writeUInt32LE(48000, 24);
    wav.writeUInt32LE(192000, 28);
    wav.writeUInt16LE(4, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++)
      for (let c = 0; c < 2; c++) {
        const v = Math.max(-1, Math.min(1, channels[c]![i]!));
        wav.writeInt16LE(Math.round(v * (v < 0 ? 32768 : 32767)), 44 + i * 4 + c * 2);
      }
    return wav;
  } catch (error) {
    if ((error as { code?: string }).code === 'build-encoder-unavailable') throw error;
    throw Object.assign(new Error((error as Error).message), {
      code: 'event-audio-load',
      pointer: '/assets',
      hint: 'check local/base64 audio source, clip bounds and declaring asset scope',
    });
  } finally {
    await encoder.close();
  }
}

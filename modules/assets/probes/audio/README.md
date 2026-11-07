# Original audio fixtures

The source is 800 mono signed little-endian 16-bit samples at 8000 Hz: sample i is
8192 when i % 16 < 8, otherwise -8192. WAV is PCM with a 44-byte header, 1644 bytes total.
FLAC is libFLAC 1.5.0, no padding or seek table, 244 bytes, lossless (800 frames, 0.1 s).
MP3 is libmp3lame 3.100: input/output 8000 Hz, mono, 32 kbps, quality 2, no VBR/gapless tag.
Four MPEG-2.5 Layer III frames × 576 samples = 2304 frames / 8000 Hz = 0.288 seconds;
1152 encoded bytes. Codec delay/padding remain; the MP3 is intentionally not called lossless.

Native subdirectories contain our independent AudioEvent scenes, unchanged source files,
command scripts and captured sessions. They verify successful decoding and triggering only;
no headless PCM result is claimed. Browser host tests independently check frame counts,
duration and every FLAC sample. Chromium converts positive FLAC PCM with divisor 32767
and negatives with 32768; Firefox uses 32768 for both. All expected values are explicit
Float32 conversions, with no relaxed waveform tolerance.

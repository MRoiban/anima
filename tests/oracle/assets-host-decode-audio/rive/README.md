# Native disposition

AudioAsset native decode accepts genuine WAV/FLAC/MP3, but no JavaScript decodeAudio callback, decoded AudioBuffer or PCM output exists in permitted headless commands. Host decoding/cache-copy tests run in both browsers instead.

See ../skip.json for reproducible local observations and Anima test evidence.

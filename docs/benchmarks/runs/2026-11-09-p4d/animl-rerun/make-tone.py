"""Generate an original 80 ms decaying 660 Hz mono PCM tone."""
import math
import struct
import wave
from pathlib import Path

rate = 22050
frames = int(rate * 0.08)
with wave.open(str(Path(__file__).with_name('tone.wav')), 'wb') as out:
    out.setparams((1, 2, rate, frames, 'NONE', 'not compressed'))
    out.writeframes(b''.join(struct.pack('<h', round(12000 * (1 - i / frames) ** 2
        * math.sin(2 * math.pi * 660 * i / rate))) for i in range(frames)))

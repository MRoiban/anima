"""Own 80 ms, 660 Hz sine with a linear decay; no external audio."""
import math
import struct
import wave
from pathlib import Path
with wave.open(str(Path(__file__).with_name('tone.wav')), 'wb') as output:
    output.setparams((1, 2, 22050, 0, 'NONE', 'not compressed'))
    output.writeframes(b''.join(
        struct.pack('<h', round(6000 * math.sin(2 * math.pi * 660 * i / 22050) * (1 - i / 1764)))
        for i in range(1764)))

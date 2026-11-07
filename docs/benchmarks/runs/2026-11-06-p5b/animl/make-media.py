"""Original 8x8 pixel covers and 1.2-second PCM tones; no dependencies."""
from pathlib import Path
import math, struct, wave, zlib
root = Path(__file__).parent
for j, name in enumerate(('dawn', 'tide', 'ember', 'moss')):
    palette = [(217,119,87), (43,124,151), (179,61,47), (99,135,81)]
    raw = b''.join(b'\0' + b''.join(bytes(palette[j] if (x+y+j)%3 else (240,238,230)) for x in range(8)) for y in range(8))
    def chunk(kind, data):
        return struct.pack('>I', len(data))+kind+data+struct.pack('>I', zlib.crc32(kind+data))
    (root / (name+'.png')).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',8,8,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))
    with wave.open(str(root/(name+'.wav')), 'wb') as wav:
        wav.setparams((1,2,8000,0,'NONE','not compressed'))
        wav.writeframes(b''.join(struct.pack('<h',round(6000*math.sin(2*math.pi*(220+j*110)*i/8000))) for i in range(9600)))

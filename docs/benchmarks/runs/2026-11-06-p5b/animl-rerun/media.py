import pathlib,struct,zlib,wave,math
out=pathlib.Path(__file__).resolve().parent/'media';out.mkdir(exist_ok=True)
for i,name in enumerate(['dawn','tide','ember']):
    colors=[(217,119,87),(20,20,19),(240,238,230)]
    rows=b''.join(b'\0'+b''.join(bytes((*colors[(x+y+i)%3],255)) for x in range(8)) for y in range(8))
    def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
    (out/f'{name}.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',8,8,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b''))
    with wave.open(str(out/f'{name}.wav'),'wb') as f:
        f.setparams((1,2,8000,0,'NONE','not compressed'))
        f.writeframes(b''.join(struct.pack('<h',int(7000*math.sin(2*math.pi*(220+i*110)*t/8000))) for t in range(9600)))

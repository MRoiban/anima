import json,pathlib,struct,zlib
root=pathlib.Path(__file__).resolve().parent
checks=[]
def check(label,value):
    checks.append({'label':label,'pass':bool(value)})
    assert value,label
rows=[json.loads(x) for x in (root/'evidence/check-011.txt').read_text().splitlines()]
check('initial titles',[rows[0]['values'][f'$tracks.{i}.title'] for i in range(3)]==['Dawn','Tide','Ember'])
for i in range(3):
    r=rows[i+1];v=r['values'];check(f'click {i} selected',v['$selected']==i+1)
    check(f'click {i} local state',v[f'rows/{i}/visits']==1)
    audio=[e for e in r['events'] if 'audio' in e]
    check(f'click {i} audio request',len(audio)==1 and audio[0]['audio']==['dawn-clip','tide-clip','ember-clip'][i] and audio[0]['payload']['uid']==i+1)
check('title changed alone',rows[-1]['values']['rows/0/title.w']==11)
check('duration changed',rows[-1]['values']['rows/0/duration.w']==12)
# Minimal RGBA PNG decoder: independent nearest-neighbour expectation.
def png(path):
    b=path.read_bytes();p=8;data=b''
    while p<len(b):
        n=struct.unpack('>I',b[p:p+4])[0];kind=b[p+4:p+8];d=b[p+8:p+8+n];p+=12+n
        if kind==b'IHDR':w,h,depth,color,*_=struct.unpack('>IIBBBBB',d)
        if kind==b'IDAT':data+=d
    assert (depth,color)==(8,6)
    raw=zlib.decompress(data);stride=w*4;lines=[];prev=[0]*stride
    for y in range(h):
        f=raw[y*(stride+1)];cur=list(raw[y*(stride+1)+1:(y+1)*(stride+1)])
        for x in range(stride):
            a=cur[x-4] if x>=4 else 0;b=prev[x];c=prev[x-4] if x>=4 else 0
            q=a+b-c;ds=[abs(q-a),abs(q-b),abs(q-c)];pa=[a,b,c][ds.index(min(ds))]
            cur[x]=(cur[x]+[0,a,b,(a+b)//2,pa][f])%256
        lines.append(cur);prev=cur
    return w,h,lines
w,h,pixels=png(root/'evidence/initial.png')
palette=[(217,119,87,255),(20,20,19,255),(240,238,230,255)]
count=0
for i in range(3):
    for y in range(48):
        for x in range(48):
            actual=tuple(pixels[84+i*72+y][(24+x)*4:(25+x)*4])
            assert actual==palette[(x//6+y//6+i)%3],(i,x,y,actual)
            count+=1
check('6912 cover pixels equal independent nearest expectation',count==6912)
b=json.loads((root/'evidence/browser.json').read_text())
check('browser host assertions',all(c['pass'] for c in b['checks']))
print(json.dumps({'checks':checks,'cover_pixels':count},indent=2))
a=json.loads((root/'evidence/check-015.txt').read_text().splitlines()[0])['values']
check('default durations',[a[f'$tracks.{i}.duration'] for i in range(3)]==[90,150,60])
check('sample count radii',[a[f'count/{i}/disc.r'] for i in range(3)]==[.4,.4,.4])
changed=[json.loads(x) for x in (root/'evidence/check-015.txt').read_text().splitlines()]
check('cover replacement routes correctly',changed[1]['values']['rows/0/tide-cover.visible'] and not changed[1]['values']['rows/0/dawn-cover.visible'])
check('clip replacement routes correctly',any(e.get('audio')=='ember-clip' for e in changed[2]['events']))
check('next-frame host checks',all(c['pass'] for c in json.loads((root/'evidence/browser-nextframe.json').read_text())['checks']))
check('all three browser clips complete',all(json.loads((root/'evidence/browser-final-audio.json').read_text())['checks'].values()))
doc=json.loads((root/'playlist.ani').read_text())
check('all media embedded',len(doc['assets'])==6 and all(v['source'].startswith('data:') for v in doc['assets'].values()))
check('authored trims retained',all(doc['assets'][n+'-clip']['start']==.2 and doc['assets'][n+'-clip']['end']==1 for n in ['dawn','tide','ember']))
(root/'evidence/assertions.json').write_text(json.dumps({'checks':checks,'cover_pixels':count},indent=2)+'\n')

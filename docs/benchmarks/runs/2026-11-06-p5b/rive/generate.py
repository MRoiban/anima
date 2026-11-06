from pathlib import Path
import math, struct, wave, zlib
P = Path(__file__).parent / 'playlist'
P.mkdir(exist_ok=True)
def validate():
    import json
    E = P/'evidence'
    assertions = 0
    def check(condition, message):
        nonlocal assertions
        assertions += 1
        assert condition, message
    def png(path):
        data = path.read_bytes(); pos = 8; compressed = b''
        while pos < len(data):
            n = struct.unpack('>I', data[pos:pos+4])[0]
            kind, body = data[pos+4:pos+8], data[pos+8:pos+8+n]
            if kind == b'IHDR':
                w,h,depth,color,_,_,interlace = struct.unpack('>IIBBBBB',body)
            if kind == b'IDAT': compressed += body
            pos += n+12
        assert depth == 8 and interlace == 0 and color in (2,6)
        bpp = 3 if color == 2 else 4
        raw = zlib.decompress(compressed); stride = w*bpp; rows=[]; previous=bytearray(stride)
        for y in range(h):
            start = y*(stride+1); mode = raw[start]; row=bytearray(raw[start+1:start+1+stride])
            for x in range(stride):
                a = row[x-bpp] if x >= bpp else 0
                b = previous[x]; c = previous[x-bpp] if x >= bpp else 0
                estimate = a+b-c
                distances = [abs(estimate-a), abs(estimate-b), abs(estimate-c)]
                paeth = [a,b,c][distances.index(min(distances))]
                row[x] = (row[x] + [0,a,b,(a+b)//2,paeth][mode])%256
            rows.append([tuple(row[x:x+3]) for x in range(0,stride,bpp)])
            previous=row
        return rows
    orders = {
        'initial': ['Dawn','Tide','Ember'],
        'dawn-click': ['Dawn','Tide','Ember'],
        'tide-click': ['Dawn','Tide','Ember'],
        'appended': ['Dawn','Tide','Ember','Moon'],
        'inserted': ['Dawn','Night','Tide','Ember','Moon'],
        'swapped': ['Tide','Night','Dawn','Ember','Moon'],
        'removed': ['Tide','Dawn','Ember','Moon'],
    }
    for name,titles in orders.items():
        d = json.loads((E/f'{name}.json').read_text())
        root = {v['name']:v for v in d['viewModel']['properties']}
        rows = [{p['name']:p.get('value') for p in row['properties']} for row in root['tracks']['items']]
        check([row['title'] for row in rows] == titles, name+' order')
        check(root['tracks']['size'] == len(titles), name+' list length')
        nested = d['nested']
        check(sum(n['artboard']=='TrackRow' for n in nested) == len(titles), name+' row count')
        check(sum(n['artboard']=='Dot' for n in nested) == len(titles), name+' derived dot count')
        selected = [r['title'] for r in rows if r['selected']]
        check(selected == ([] if name=='initial' else ['Dawn'] if name=='dawn-click' else ['Tide']), name+' selected')
        if name not in ('initial','dawn-click'):
            check(next(r for r in rows if r['title']=='Tide')['requests']==1, name+' own state retained')
        frame = png(E/f'{name}.png')
        check(len(frame)==360 and len(frame[0])==480, name+' dimensions')
        for i,row in enumerate(rows):
            cover = png(P/(row['audioClip'].replace('Clip','')+'.png'))
            # Native capture dithers flat image colours by one channel value.
            mismatches = sum(max(abs(a-b) for a,b in zip(frame[24+72*i+y][24+x], cover[y//6][x//6])) > 1 for y in range(48) for x in range(48))
            check(mismatches==0, f'{name} cover {i}: {mismatches} differs from nearest by more than 1/channel')
            # Bar interiors, and the pixel just after each end, prove their dimensions.
            for y,width,color in [(30+72*i,12*len(row['title']),(20,20,19)),(54+72*i,round(row['duration']*1.2),(217,119,87))]:
                check(all(max(abs(a-b) for a,b in zip(frame[y+4][x],color))<=1 for x in range(96,96+width)), name+' bar interior')
                check(max(abs(a-b) for a,b in zip(frame[y+4][96+width],(240,238,230)))<=1, name+' bar endpoint')
        for i in range(len(rows)):
            check(max(abs(a-b) for a,b in zip(frame[round(336-14.4*i)][456],(20,20,19)))<=1, name+' visible dot')
        check(max(abs(a-b) for a,b in zip(frame[round(336-14.4*len(rows))][456],(240,238,230)))<=1, name+' no extra dot')
    for name,total,clip in [('dawn-click',1,'dawn'),('tide-click',2,'tide'),('ember-click',3,'ember'),('moon-click',4,'moon')]:
        d=json.loads((E/f'{name}.json').read_text())
        root={v['name']:v.get('value') for v in d['viewModel']['properties']}
        check(root['playbackRequests']==total, name+' request count')
        check(root['lastClip']==clip+'Clip', name+' correct clip')
        check(abs(root['clipDuration']-.8)<1e-6, name+' decoded trim duration')
        with wave.open(str(P/f'{clip}.wav'),'rb') as source:
            source.setpos(3200); expected=source.readframes(12800)
        with wave.open(str(P/f'{clip}-clip.wav'),'rb') as trimmed:
            check(trimmed.getnframes()==12800 and trimmed.readframes(12800)==expected, name+' exact .2-1.0s trim')
    print(f'PASS: {assertions} assertions; nearest cover pixels within 1/channel, bars, dot positions, list edits, state and audio requests')

import sys
if '--check' in sys.argv:
    validate()
    sys.exit(0)

# Self-made 8x8 covers and 1.2 second mono tones.
for k, name in enumerate(['dawn','tide','ember','moon']):
    colors = [(20,20,19), (217,119,87), (240,238,230), (55+25*k,90+20*k,140)]
    raw = b''.join(b'\0'+bytes(sum((list(colors[(x//2+y//2+k)%4]) for x in range(8)),[])) for y in range(8))
    def chunk(t, b): return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b))
    (P/f'{name}.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',8,8,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))
    with wave.open(str(P/f'{name}.wav'),'wb') as w:
        w.setparams((1,2,16000,0,'NONE','not compressed'))
        w.writeframes(b''.join(struct.pack('<h',round(7000*math.sin(2*math.pi*(220+110*k)*i/16000)*min(1,i/400,(19200-i)/400))) for i in range(19200)))
    with wave.open(str(P/f'{name}.wav'),'rb') as source:
        source.setpos(3200)
        frames = source.readframes(12800)
    with wave.open(str(P/f'{name}-clip.wav'),'wb') as target:
        target.setparams((1,2,16000,0,'NONE','not compressed'))
        target.writeframes(frames)
controller = '''type Controller = { vm: ViewModel?, context: Context, seen: {[string]: number}, selected: string, serial: number }
local function clone(self: Controller, source: ViewModel): ViewModel
    local row = source:instance()
    for _, name in {'title', 'audioClip', 'uid'} do
        local a, b = source:getString(name), row:getString(name)
        if a and b then b.value = a.value end
    end
    for _, name in {'duration', 'titleWidth'} do
        local a, b = source:getNumber(name), row:getNumber(name)
        if a and b then b.value = a.value end
    end
    local a, b = source:getImage('cover'), row:getImage('cover')
    if a and b then b.value = a.value end
    self.serial += 1
    local uid = row:getString('uid')
    if uid then uid.value ..= tostring(self.serial) end
    return row
end
local function init(self: Controller, context: Context): boolean
    self.vm = context:viewModel()
    print("controller-init")
    return true
end
local function advance(self: Controller, dt: number): boolean
    local vm = self.vm
    if not vm then return false end
    local tracks = vm:getList('tracks')
    if not tracks then return false end
    local command = vm:getString('command')
    local candidate = vm:getViewModel('newTrack')
    local index = vm:getNumber('index')
    local other = vm:getNumber('otherIndex')
    if command and candidate and index and other and command.value ~= '' then
        local op = command.value
        if op == 'append' then tracks:push(clone(self, candidate.value))
        elseif op == 'insert' then tracks:insert(clone(self, candidate.value), index.value + 1)
        elseif op == 'remove' then tracks:removeAt(index.value + 1)
        elseif op == 'swap' then tracks:swap(index.value + 1, other.value + 1) end
        print('host-edit ' .. op)
        command.value = ''
    end
    for i = 1, tracks.length do
        local row = tracks[i]
        local title = row:getString('title')
        local width = row:getNumber('titleWidth')
        local id = row:getString('uid')
        local requests = row:getNumber('requests')
        local clip = row:getString('audioClip')
        local selected = row:getNumber('selected')
        if title and width then width.value = #title.value * 12 end
        if id and requests and clip then
            local previous = self.seen[id.value] or 0
            if requests.value > previous then
                self.selected = id.value
                local audio = self.context:audio(clip.value)
                local requestCount = vm:getNumber('playbackRequests')
                local lastClip = vm:getString('lastClip')
                local clipDuration = vm:getNumber('clipDuration')
                if requestCount then requestCount.value += 1 end
                if lastClip then lastClip.value = clip.value end
                if audio then
                    if clipDuration then clipDuration.value = audio.duration end
                    Audio.play(audio)
                    print('playback-request ' .. clip.value .. ' duration=' .. tostring(audio.duration))
                else print('missing-audio ' .. clip.value) end
            end
            self.seen[id.value] = requests.value
            if selected then selected.value = if self.selected == id.value then 1 else 0 end
        end
    end
    return true
end
return function(context: Context): Layout<Controller>
    return {vm = context:viewModel(), context = context, seen = {}, selected = '', serial = 0, init = init, advance = advance}
end
'''
# Keep controller source in this generator; regenerate before running the project.
# Controller is embedded below so scene.rml runs without extra source files.
parts = ['<Rive version="1" kind="fragment">']
def add(s): parts.append(s)
def bind(path,key,converter=''): return f'<DataBindContext sourcePathIds="{path}" propertyKey="{key}"'+(f' converterId="{converter}"' if converter else '')+'/>'
def machine(id,body=''): return f'<StateMachine name="Main" id="0:{id}"><StateMachineLayer><AnyState x="0" y="0"/><ExitState x="200" y="0"/><EntryState x="400" y="0"/></StateMachineLayer>{body}</StateMachine>'
def rect(name,x,y,w,h,color,content=''):
    return f'<Shape name="{name}" x="{x}" y="{y}"><Rectangle width="{w}" height="{h}" originX="0" originY="0">{content}</Rectangle><Fill><SolidColor colorValue="{color}"/></Fill></Shape>'
# Main board, fixed layout containers positioned from the grid.
add('<Artboard name="Playlist" id="0:1" width="480" height="360" viewModelId="0:100" viewModelInstanceId="0:110" defaultStateMachineId="0:10" styleId="0:2">')
add('<LayoutComponentStyle id="0:2"/>')
add('<LayoutComponent name="ControllerBox" width="1" height="1" styleId="0:9"><LayoutComponentStyle id="0:9" positionTypeValue="absolute"/><ScriptedLayout scriptAssetId="0:900" name="Controller"/></LayoutComponent>')
add('<LayoutComponent name="Tracks" width="456" height="288" styleId="0:4"><LayoutComponentStyle id="0:4" positionTypeValue="absolute" positionLeft="0" positionTop="24" positionLeftUnitsValue="points" positionTopUnitsValue="points" flexDirectionValue="column"/><ArtboardComponentList name="Rows">'+bind('0:100-0:101',800)+'</ArtboardComponentList></LayoutComponent>')
add('<LayoutComponent name="Counter" width="10" height="120" styleId="0:6"><LayoutComponentStyle id="0:6" positionTypeValue="absolute" positionLeft="451.2" positionTop="221" positionLeftUnitsValue="points" positionTopUnitsValue="points" flexDirectionValue="columnReverse"/><ArtboardComponentList name="Dots">'+bind('0:100-0:101',800,'0:802')+'</ArtboardComponentList></LayoutComponent>')
add(rect('Panel',0,0,480,360,'FFF0EEE6'))
add(machine(10)); add('</Artboard>')
# One row design, reused natively for every list item.
add('<Artboard name="TrackRow" x="600" y="0" id="0:20" isComponent="true" width="456" height="72" viewModelId="0:200" viewModelInstanceId="0:220" defaultStateMachineId="0:21" styleId="0:22" clip="false"><LayoutComponentStyle id="0:22" layoutWidthScaleType="fixed" layoutHeightScaleType="fixed"/>')
add('<Shape name="Highlight" x="22.2" y="-1.8">'+bind('0:200-0:207',18)+'<Rectangle width="409.2" height="51.6" originX="0" originY="0"/><Stroke thickness="3.6"><SolidColor colorValue="FFD97757"/></Stroke></Shape>')
add('<Image name="Cover" x="24" y="0" originX="0" originY="0" scaleX="6" scaleY="6" assetId="0:500" samplerFilter="nearest">'+bind('0:200-0:203',206)+'</Image>')
add(rect('Title',96,6,48,12,'FF141413',bind('0:200-0:206',20)))
add(rect('Duration',96,30,108,12,'FFD97757',bind('0:200-0:202',20,'0:803')))
add('<Shape name="Hit" id="0:25"><Rectangle width="432" height="48" originX="0" originY="0"/></Shape>')
listener='<StateMachineListenerSingle targetId="0:25" listenerTypeValue="click"><ListenerViewModelChange fromViewModelProperty="true" fromDataBindId="0:27"><BindablePropertyNumber><DataBindContext id="0:27" sourcePathIds="0:200-0:205" propertyKey="636" converterId="0:804"/><DataBindContext sourcePathIds="0:200-0:205" propertyKey="636" direction="true"/></BindablePropertyNumber></ListenerViewModelChange></StateMachineListenerSingle>'
add(machine(21,listener)); add('</Artboard><ComponentAsset artboardId="0:20" name="TrackRow"/>')
add('<Artboard name="Dot" x="1200" y="0" id="0:30" isComponent="true" width="9.6" height="14.4" viewModelId="0:300" defaultStateMachineId="0:31" styleId="0:32"><LayoutComponentStyle id="0:32" layoutWidthScaleType="fixed" layoutHeightScaleType="fixed"/><Shape x="4.8" y="9.4"><Ellipse width="9.6" height="9.6"/><Fill><SolidColor colorValue="FF141413"/></Fill></Shape>'+machine(31)+'</Artboard><ComponentAsset artboardId="0:30" name="Dot"/>')
add('<ViewModel id="0:300" name="Dot" defaultInstanceId="0:301"><ViewModelInstance id="0:301" name="Default" exports="true"/></ViewModel>')
add('<ViewModel id="0:200" name="Track" defaultInstanceId="0:220">')
fields=[('String','title',201),('Number','duration',202),('AssetImage','cover',203),('String','audioClip',204),('Number','requests',205),('Number','titleWidth',206),('Number','selected',207),('String','uid',208)]
for typ,name,id in fields: add(f'<ViewModelProperty{typ} name="{name}" id="0:{id}"/>')
for k,(title,duration) in enumerate([('Dawn',90),('Tide',150),('Ember',60),('Moon',120)]):
    add(f'<ViewModelInstance id="0:{220+k}" name="{title}" exports="true">')
    for (typ,name,id),value in zip(fields,[title,duration,f'0:{500+k}',title.lower()+'Clip',0,len(title)*12,0,title.lower()]): add(f'<ViewModelInstance{typ} viewModelPropertyId="0:{id}" propertyValue="{value}"/>')
    add('</ViewModelInstance>')
add('</ViewModel>')
add('<ViewModel id="0:100" name="Playlist" defaultInstanceId="0:110"><ViewModelPropertyList id="0:101" name="tracks"/><ViewModelPropertyString id="0:102" name="command"/><ViewModelPropertyNumber id="0:103" name="index"/><ViewModelPropertyNumber id="0:104" name="otherIndex"/><ViewModelPropertyViewModel id="0:105" name="newTrack" viewModelReferenceId="0:200"/><ViewModelPropertyNumber id="0:106" name="playbackRequests"/><ViewModelPropertyString id="0:107" name="lastClip"/><ViewModelPropertyNumber id="0:108" name="clipDuration"/><ViewModelInstance id="0:110" name="Default" exports="true"><ViewModelInstanceList viewModelPropertyId="0:101">')
for k in range(3): add(f'<ViewModelInstanceListItem viewModelId="0:200" viewModelInstanceId="0:{220+k}"/>')
add('</ViewModelInstanceList><ViewModelInstanceString viewModelPropertyId="0:102" propertyValue=""/><ViewModelInstanceNumber viewModelPropertyId="0:103" propertyValue="1"/><ViewModelInstanceNumber viewModelPropertyId="0:104" propertyValue="0"/><ViewModelInstanceViewModel viewModelPropertyId="0:105" propertyValue="0:223"/><ViewModelInstanceNumber viewModelPropertyId="0:106" propertyValue="0"/><ViewModelInstanceString viewModelPropertyId="0:107" propertyValue=""/><ViewModelInstanceNumber viewModelPropertyId="0:108" propertyValue="0"/></ViewModelInstance></ViewModel>')
add('<DataConverterListToLength id="0:800"/><DataConverterNumberToList viewModelId="0:300" id="0:801"/><DataConverterGroup id="0:802"><DataConverterGroupItem converterId="0:800"/><DataConverterGroupItem converterId="0:801"/></DataConverterGroup><DataConverterOperationValue id="0:803" operationType="2" operationValue="1.2"/><DataConverterOperationValue id="0:804" operationType="0" operationValue="1"/>')
for k,name in enumerate(['dawn','tide','ember','moon']):
    add(f'<ImageAsset id="0:{500+k}" name="{name}" file="{name}.png" samplerFilter="1"/>')
    add(f'<AudioAsset id="0:{600+k}" name="{name}Sound" file="{name}.wav"/><AudioAsset id="0:{700+k}" file="{name}-clip.wav" includeInExport="true" name="{name}Clip"/>')
add('<ScriptAsset id="0:900" name="controller"><![CDATA[\n'+controller+']]></ScriptAsset>')
add('</Rive>')
(P/'scene.rml').write_text('\n'.join(parts)+'\n')

from pathlib import Path
from xml.sax.saxutils import escape, quoteattr
out = Path(__file__).parent
s = ['<anima version="0.1" name="settings" grid="40" viewBox="0 0 40 30" requires="data bind derive convert a11y a11yactions focus input">', '<model name="Settings">', '<number name="volume" default="40" min="0" max="100"/>', '<bool name="muted" default="false"/>', '<number name="selectedTab" default="0" min="0" max="1"/>']
for name, default in [('email','true'),('push','false'),('sms','false')]:
    s.append(f'<bool name="{name}" default="{default}"/>')
labels = {'generalTitle':'General','soundTitle':'Sound','notificationsLabel':'Notifications','emailLabel':'Email','pushLabel':'Push','smsLabel':'SMS','muteLabel':'Mute'}
for name, val in labels.items(): s.append(f'<string name="{name}" default="{val}"/>')
for name, expr in [('generalSelected','$selectedTab == 0'),('soundSelected','$selectedTab == 1'),('allChecked','$email and $push and $sms'),('anyChecked','$email or $push or $sms'),('mixed','($email or $push or $sms) and not ($email and $push and $sms)')]:
    s.append(f'<bool name="{name}" value="{expr}"/>')
s += ['<string name="volumeSpoken" value="$volume" convert="volumeText"/>','</model>','<instance name="main" model="Settings" default="true" export="true"/>','<converter name="volumeText" type="template" text="Volume {0} %"/>','<trigger name="chooseGeneral"/>','<trigger name="chooseSound"/>','<trigger name="toggleParent"/>','<rect id="background" x0="0" y0="0" width="40" height="30" fill="#f0eee6"/>','<group id="tabs"><a11y role="tab-list" label="Settings"/><focus enabled="false" scope="true" edge="closed-loop"/>']
for id,x,title,selected,activate in [('generalTab',2,'generalTitle','generalSelected','chooseGeneral'),('soundTab',14,'soundTitle','soundSelected','chooseSound')]:
    s += [f'<rect id="{id}" x0="{x}" y0="2" width="10" height="3" fill="#f0eee6" stroke="#141413" stroke-width="0.15">',f'<a11y role="tab" label="${title}" selected="${selected}" activate="{activate}"/>',f'<focus bounds="{x} 2 10 3"/>','</rect>',f'<bind target="{id}.fill" value="mix(#f0eee6, #d97757, ${selected})"/>']
s += ['</group>','<group id="generalPanel">']
for id,x,y,checked,mixed,activate,label in [('parent',2,8,'allChecked','mixed','toggleParent','notificationsLabel'),('emailBox',4,12,'email',None,'$email','emailLabel'),('pushBox',4,16,'push',None,'$push','pushLabel'),('smsBox',4,20,'sms',None,'$sms','smsLabel')]:
    s += [f'<rect id="{id}" x0="{x}" y0="{y}" width="2" height="2" fill="#f0eee6" stroke="#141413" stroke-width="0.15">',f'<a11y role="checkbox" label="${label}" checked="${checked}" activate="{activate}"'+(f' checked-mixed="${mixed}"' if mixed else '')+'/>',f'<focus bounds="{x} {y} 2 2"/>','</rect>',f'<bind target="{id}.fill" value="mix(#f0eee6, #141413, ${checked})"/>']
s += ['<path id="mixedBar" d="M2.4 9L3.6 9" stroke="#141413" stroke-width="0.25"/>','</group>','<group id="soundPanel">','<rect id="volumeTrack" x0="2" y0="10" width="30" height="1" fill="#141413">','<a11y role="slider" label="$volumeSpoken" value="$volume" min="0" max="100" step="5"/>','<focus bounds="2 10 30 1"/>','</rect>','<rect id="volumeFill" x0="2" y0="10" width="12" height="1" fill="#d97757"/>','<rect id="muteSwitch" x0="2" y0="16" width="6" height="3" rx="1.5" fill="#141413">','<a11y role="switch" label="$muteLabel" checked="$muted" activate="$muted"/>','<focus bounds="2 16 6 3"/>','</rect>','<circle id="muteKnob" cx="3.5" cy="17.5" r="1.2" fill="#d97757"/>','</group>']
for target,value in [('generalPanel.visible','$generalSelected'),('soundPanel.visible','$soundSelected'),('mixedBar.visible','$mixed'),('volumeFill.width','$volume / 100 * 30'),('muteKnob.x','3 * $muted')]: s.append(f'<bind target="{target}" value="{value}"/>')
# A small original vector bitmap alphabet. These labels support the declared strings only.
font = {
'a':['000','010','001','011','101','011','000'], 'c':['000','000','011','100','100','011','000'],
'e':['000','000','010','101','110','011','000'], 'f':['011','100','110','100','100','100','000'],
'g':['000','011','101','011','001','110','000'], 'h':['100','100','110','101','101','101','000'],
'i':['010','000','010','010','010','010','000'], 'l':['100','100','100','100','100','011','000'],
'm':['000','000','11011','10101','10101','10101','000'], 'n':['000','000','110','101','101','101','000'],
'o':['000','000','010','101','101','010','000'], 'p':['000','000','110','101','110','100','100'],
'r':['000','000','101','110','100','100','000'], 's':['000','000','011','100','001','110','000'],
't':['010','110','010','010','010','001','000'], 'u':['000','000','101','101','101','011','000'],
'v':['000','000','101','101','101','010','000'], 'd':['001','001','011','101','101','011','000'],
'G':['011','100','100','101','101','011','000'], 'S':['011','100','010','001','001','110','000'],
'N':['101','111','111','101','101','101','000'], 'E':['111','100','110','100','100','111','000'],
'P':['110','101','110','100','100','100','000'], 'M':['10001','11011','10101','10001','10001','10001','000'],
'V':['101','101','101','101','101','010','000'], '0':['111','101','101','101','101','111','000'],
}
# Label coordinates stay in the card's grid; visibility follows both data and selected panel.
placements=[('generalTitle',3,2.9,None),('soundTitle',15,2.9,None),('notificationsLabel',5,8.6,'generalSelected'),('emailLabel',7,12.6,'generalSelected'),('pushLabel',7,16.6,'generalSelected'),('smsLabel',7,20.6,'generalSelected'),('muteLabel',10,16.8,'soundSelected')]
for name,x,y,show in placements:
    word=labels[name]; path=[]; cursor=x; unit=.18
    for c in word:
        rows=font[c]
        for row,bits in enumerate(rows):
            for col,bit in enumerate(bits):
                if bit=='1':
                    px=cursor+col*unit; py=y+row*unit
                    path.append(f'M{px:.3f} {py:.3f}h{unit}v{unit}h-{unit}Z')
        cursor += (max(map(len,rows))+1)*unit
    s.append(f'<path id="label-{name}" d="{"".join(path)}" fill="#141413"/>')
    condition=f'${name} == &quot;{word}&quot;'+(f' and ${show}' if show else '')
    s.append(f'<bind target="label-{name}.visible" value="{condition}"/>')
s += ['<layer name="actions" initial="ready"><state name="ready">', '<on when="chooseGeneral" to="ready" actions=\'{"set":{"$selectedTab":0}}\'/>','<on when="chooseSound" to="ready" actions=\'{"set":{"$selectedTab":1}}\'/>','<on when="toggleParent" to="ready" actions=\'{"set":{"$email":"not ($email and $push and $sms)","$push":"not ($email and $push and $sms)","$sms":"not ($email and $push and $sms)"}}\'/>','</state></layer>']
for id,trig in [('generalTab','chooseGeneral'),('soundTab','chooseSound')]:
    s += [f'<listener on="click" target="{id}" fire="{trig}"/>',f'<listener on="focus" target="{id}" fire="{trig}"/>']
for id,action in [('parent','fire="toggleParent"'),('emailBox','toggle="$email"'),('pushBox','toggle="$push"'),('smsBox','toggle="$sms"'),('muteSwitch','toggle="$muted"')]:
    s.append(f'<listener on="click" target="{id}" {action}/>')
    for key in ['Enter',' ']:
        s.append(f'<listener on="key-down" target="{id}" key="{key}" {action}/>')
for key,expr in [('ArrowRight','min(100, $volume + 5)'),('ArrowUp','min(100, $volume + 5)'),('ArrowLeft','max(0, $volume + -5)'),('ArrowDown','max(0, $volume + -5)')]:
    s.append(f'<listener on="key-down|key-repeat" target="volumeTrack" key="{key}" set="$volume={expr.replace(" ","")}"/>')
s.append('</anima>')
binds = [line for line in s if line.startswith('<bind ')]
s = [line for line in s if not line.startswith('<bind ')]
s[-1:-1] = binds
(out/'settings.animl').write_text('\n'.join(s)+'\n')

from pathlib import Path
from html import escape

HERE = Path(__file__).resolve().parent
FONT = {
    'D':['11110','10001','10001','10001','10001','10001','11110'],
    'A':['01110','10001','10001','11111','10001','10001','10001'],
    'C':['01111','10000','10000','10000','10000','10000','01111'],
    'E':['11111','10000','10000','11110','10000','10000','11111'],
    'F':['11111','10000','10000','11110','10000','10000','10000'],
    'G':['01111','10000','10000','10111','10001','10001','01110'],
    'H':['10001','10001','10001','11111','10001','10001','10001'],
    'I':['111','010','010','010','010','010','111'],
    'L':['10000','10000','10000','10000','10000','10000','11111'],
    'M':['10001','11011','10101','10101','10001','10001','10001'],
    'N':['10001','11001','10101','10011','10001','10001','10001'],
    'O':['01110','10001','10001','10001','10001','10001','01110'],
    'P':['11110','10001','10001','11110','10000','10000','10000'],
    'R':['11110','10001','10001','11110','10100','10010','10001'],
    'S':['01111','10000','10000','01110','00001','00001','11110'],
    'T':['11111','00100','00100','00100','00100','00100','00100'],
    'U':['10001','10001','10001','10001','10001','10001','01110'],
    'V':['10001','10001','10001','10001','10001','01010','00100'],
}
# AniML has no documented text primitive. These vector labels are a static fallback.
def label(id, text, x, y, pixel=.17):
    d=[]
    at=x
    for ch in text.upper():
        rows=FONT[ch]
        for r,row in enumerate(rows):
            for c,v in enumerate(row):
                if v=='1':
                    a,b=at+c*pixel,y+r*pixel
                    d.append(f'M{a:.3f} {b:.3f}h{pixel:.3f}v{pixel:.3f}h{-pixel:.3f}Z')
        at+=(len(rows[0])+1)*pixel
    return f'<path id="{id}" d="{"".join(d)}" fill="#141413"/>'

out=['''<anima version="0.1" name="settings" grid="40" viewBox="0 0 40 30" requires="bind data derive convert a11y a11yactions focus input host">
  <model name="Settings">
    <number name="volume" default="40" min="0" max="100"/>
    <bool name="muted" default="false"/>
    <enum name="selectedTab" values="general sound" default="general"/>
    <bool name="email" default="true"/>
    <bool name="push" default="false"/>
    <bool name="sms" default="false"/>
    <string name="generalTitle" default="General"/>
    <string name="soundTitle" default="Sound"/>
    <string name="notificationsTitle" default="Notifications"/>
    <string name="emailTitle" default="Email"/>
    <string name="pushTitle" default="Push"/>
    <string name="smsTitle" default="SMS"/>
    <string name="volumeTitle" default="Volume"/>
    <string name="muteTitle" default="Mute"/>
    <bool name="generalSelected" value='$selectedTab == "general"'/>
    <bool name="soundSelected" value='$selectedTab == "sound"'/>
    <bool name="allChecked" value="$email and $push and $sms"/>
    <bool name="someChecked" value="($email or $push or $sms) and not ($email and $push and $sms)"/>
    <string name="volumeText" value="$volume" convert="spokenVolume"/>
  </model>
  <instance name="settings" model="Settings" default="true"/>
  <converter name="spokenVolume" type="template" text="Volume {0} %"/>
  <trigger name="selectGeneral"/>
  <trigger name="selectSound"/>
  <trigger name="toggleAll"/>
  <rect id="panel" x0="0" y0="0" width="40" height="30" fill="#f0eee6"/>
  <group id="tabs">
    <a11y role="tab-list" label="Settings" bounds="2 2 22 3"/>
    <group id="generalTab">
      <a11y role="tab" label="$generalTitle" selected="$generalSelected" activate="selectGeneral" bounds="2 2 10 3"/>
      <rect id="generalTabShape" x0="2" y0="2" width="10" height="3" fill="#d97757" stroke="#141413" stroke-width="0.15"/>
''',label('generalLabel','General',3,2.9),'''
    </group>
    <group id="soundTab">
      <a11y role="tab" label="$soundTitle" selected="$soundSelected" activate="selectSound" bounds="14 2 10 3"/>
      <rect id="soundTabShape" x0="14" y0="2" width="10" height="3" fill="#f0eee6" stroke="#141413" stroke-width="0.15"/>
''',label('soundLabel','Sound',15,2.9),'''
    </group>
  </group>
  <group id="generalPanel">
''']
for id,x,y,path,text in [('notifications',2,8,'allChecked','Notifications'),('email',4,12,'email','Email'),('push',4,16,'push','Push'),('sms',4,20,'sms','SMS')]:
    mixed=' checked-mixed="$someChecked" activate="toggleAll"' if id=='notifications' else ''
    out.append(f'''<group id="{id}">
      <a11y role="checkbox" label="${id}Title" checked="${path}"{mixed} bounds="{x} {y} 2 2"/>
      <rect id="{id}Outline" x0="{x}" y0="{y}" width="2" height="2" fill="#f0eee6" stroke="#141413" stroke-width="0.15"/>
      <rect id="{id}Fill" x0="{x}" y0="{y}" width="2" height="2" fill="#141413"/>
''')
    if id=='notifications':
        out.append('<rect id="mixedBar" x0="2.3" y0="8.85" width="1.4" height="0.3" fill="#141413"/>')
    out.append(label(id+'Label',text,x+3,y+.4))
    out.append('</group>')
    out.append(f'<bind target="{id}Fill.visible" value="${path}"/>')
out.extend(['''
  </group>
  <group id="soundPanel">
    <group id="volume">
      <a11y role="slider" label="$volumeTitle" value="$volume" value-text="$volumeText" min="0" max="100" step="5" bounds="2 10 30 1"/>
      <rect id="volumeTrack" x0="2" y0="10" width="30" height="1" fill="#141413"/>
      <rect id="volumeFill" x0="2" y0="10" width="12" height="1" fill="#d97757"/>
''', label('volumeLabel','Volume',2,8),'''
    </group>
    <group id="mute">
      <a11y role="switch" label="$muteTitle" checked="$muted" bounds="2 16 6 3"/>
      <rect id="muteTrack" x0="2" y0="16" width="6" height="3" rx="1.5" fill="#141413"/>
      <circle id="muteKnob" cx="3.5" cy="17.5" r="1.2" fill="#f0eee6"/>
''',label('muteLabel','Mute',9,16.9),'''
    </group>
  </group>
  <bind target="generalPanel.visible" value="$generalSelected"/>
  <bind target="soundPanel.visible" value="$soundSelected"/>
  <bind target="generalTabShape.fill" value="mix(#f0eee6, #d97757, $generalSelected)"/>
  <bind target="soundTabShape.fill" value="mix(#f0eee6, #d97757, $soundSelected)"/>
  <bind target="mixedBar.visible" value="$someChecked"/>
  <bind target="volumeFill.width" value="$volume / 100 * 30"/>
  <bind target="muteKnob.x" value="$muted * 3"/>
  <bind target="muteTrack.fill" value="mix(#141413, #d97757, $muted)"/>
  <listener on="focus" target="generalTab" set='$selectedTab="general"'/>
  <listener on="focus" target="soundTab" set='$selectedTab="sound"'/>
  <listener on="click" target="generalTab" fire="selectGeneral"/>
  <listener on="click" target="soundTab" fire="selectSound"/>
  <listener on="click" target="notifications" fire="toggleAll"/>
  <listener on="click" target="email" toggle="$email"/>
  <listener on="click" target="push" toggle="$push"/>
  <listener on="click" target="sms" toggle="$sms"/>
  <listener on="click" target="mute" toggle="$muted"/>
  <layer name="actions" initial="ready">
    <state name="ready">
      <on when="selectGeneral" to="ready" actions='{"set":{"$selectedTab":"\\"general\\""}}'/>
      <on when="selectSound" to="ready" actions='{"set":{"$selectedTab":"\\"sound\\""}}'/>
      <on when="toggleAll" to="ready" actions='{"set":{"$email":"not ($email and $push and $sms)","$push":"not ($email and $push and $sms)","$sms":"not ($email and $push and $sms)"}}'/>
    </state>
  </layer>
</anima>
'''])
# Bind is a root element, not a group child: hoist checkbox bindings.
import re
source='\n'.join(out)
bindings=re.findall(r'<bind target="(?:notifications|email|push|sms)Fill.visible"[^>]+/>',source)
for b in bindings:
    source=source.replace(b,'')
source=source.replace('</anima>','\n'.join(bindings)+'\n</anima>')
(HERE/'settings.animl').write_text(source)

from pathlib import Path
from html import escape
P=Path(__file__).parent
# Original small monoline alphabet; drawing labels is a documented-format workaround.
FONT={
'A':'0,6 0,2 2,0 4,2 4,6|0,3 4,3','B':'0,6 0,0 3,0 4,1 4,2 3,3 0,3|3,3 4,4 4,5 3,6 0,6',
'C':'4,0 1,0 0,1 0,5 1,6 4,6','D':'0,0 2,0 4,2 4,4 2,6 0,6 0,0','E':'4,0 0,0 0,6 4,6|0,3 3,3',
'F':'4,0 0,0 0,6|0,3 3,3','G':'4,1 3,0 1,0 0,1 0,5 1,6 4,6 4,3 2,3','H':'0,0 0,6|4,0 4,6|0,3 4,3',
'I':'0,0 4,0|2,0 2,6|0,6 4,6','L':'0,0 0,6 4,6','M':'0,6 0,0 2,3 4,0 4,6','N':'0,6 0,0 4,6 4,0',
'O':'1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0','P':'0,6 0,0 3,0 4,1 4,2 3,3 0,3',
'R':'0,6 0,0 3,0 4,1 4,2 3,3 0,3|2,3 4,6','S':'4,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 0,6',
'T':'0,0 4,0|2,0 2,6','U':'0,0 0,5 1,6 3,6 4,5 4,0','V':'0,0 2,6 4,0'}
def label(id,text,x,y,size=.19):
 d=[]
 for i,c in enumerate(text.upper()):
  for seg in FONT[c].split('|'):
   pts=[tuple(map(float,p.split(','))) for p in seg.split()]
   d.append('M'+'L'.join(f'{x+(i*6+a)*size:g} {y+b*size:g}' for a,b in pts))
 return f'<path id="{id}" d="{"".join(d)}" stroke="#141413" stroke-width="0.12"/>'
a=['<anima version="0.1" name="settings-card" grid="40" viewBox="0 0 40 30" requires="data bind derive convert a11y a11yactions focus">',
'<model name="Settings">', '<number name="volume" default="40" min="0" max="100"/>','<bool name="muted"/>',
'<number name="selectedTab" default="0" min="0" max="1"/>','<bool name="email" default="true"/>','<bool name="push"/>','<bool name="sms"/>']
for name,s in [('generalTitle','General'),('soundTitle','Sound'),('notificationsLabel','Notifications'),('emailLabel','Email'),('pushLabel','Push'),('smsLabel','SMS'),('volumeLabel','Volume'),('muteLabel','Mute'),('tabsLabel','Settings')]:
 a.append(f'<string name="{name}" default="{s}"/>')
for name,expr in [('generalSelected','$selectedTab == 0'),('soundSelected','$selectedTab == 1'),('allNotifications','$email and $push and $sms'),('someNotifications','($email or $push or $sms) and not ($email and $push and $sms)')]:
 a.append(f'<bool name="{name}" value="{expr}"/>')
a+=['<string name="volumeText" value="$volume" convert="spokenVolume"/>','</model>','<instance name="settings" model="Settings" default="true" export="true"/>','<converter name="spokenVolume" type="template" text="Volume {0} %"/>','<trigger name="chooseGeneral"/>','<trigger name="chooseSound"/>','<trigger name="toggleNotifications"/>', '<rect id="panel" x0="0" y0="0" width="40" height="30" fill="#f0eee6"/>','<group id="tabs"><a11y role="tab-list" label="$tabsLabel"/>']
for id,x,title,selected,trigger in [('general',2,'generalTitle','generalSelected','chooseGeneral'),('sound',14,'soundTitle','soundSelected','chooseSound')]:
 a+=[f'<group id="{id}"><a11y role="tab" label="${title}" selected="${selected}" activate="{trigger}" bounds="{x} 2 10 3"/>',f'<rect id="{id}Shape" x0="{x}" y0="2" width="10" height="3" fill="#f0eee6" stroke="#141413" stroke-width="0.15"/>',label(id+'Text',id,x+.7,2.9),'</group>']
a+=['</group>','<group id="generalPanel">']
for id,x,y,name,checked in [('notifications',2,8,'notificationsLabel','allNotifications'),('email',4,12,'emailLabel','email'),('push',4,16,'pushLabel','push'),('sms',4,20,'smsLabel','sms')]:
 extra=' checked-mixed="$someNotifications" activate="toggleNotifications"' if id=='notifications' else ''
 a+=[f'<group id="{id}"><a11y role="checkbox" label="${name}" checked="${checked}"{extra} bounds="{x} {y} 2 2"/>',f'<rect id="{id}Outline" x0="{x}" y0="{y}" width="2" height="2" fill="#f0eee6" stroke="#141413" stroke-width="0.15"/>',f'<rect id="{id}Fill" x0="{x}" y0="{y}" width="2" height="2" fill="#141413"/>',label(id+'Text','Notifications' if id=='notifications' else id,x+3,y+.4),'</group>']
 if id=='notifications':
  a.append('<rect id="mixedBar" x0="2.4" y0="8.85" width="1.2" height="0.3" fill="#141413"/>')
a+=['</group>','<group id="soundPanel">','<group id="volume"><a11y role="slider" label="$volumeLabel" value="$volume" value-text="$volumeText" min="0" max="100" step="5" bounds="2 9 30 3"/>', '<rect id="volumeTrack" x0="2" y0="10" width="30" height="1" fill="#141413"/>','<rect id="volumeFill" x0="2" y0="10" width="12" height="1" fill="#d97757"/>', label('volumeText','Volume',2,7.4),'</group>', '<group id="mute"><a11y role="switch" label="$muteLabel" checked="$muted" bounds="2 16 6 3"/>','<rect id="muteTrack" x0="2" y0="16" width="6" height="3" rx="1.5" fill="#141413"/>','<circle id="muteKnob" cx="3.5" cy="17.5" r="1.2" fill="#f0eee6"/>',label('muteText','Mute',9,16.9),'</group>','</group>']
bindings={'generalPanel.visible':'$generalSelected','soundPanel.visible':'$soundSelected','generalShape.fill':'mix(#f0eee6, #d97757, $generalSelected)','soundShape.fill':'mix(#f0eee6, #d97757, $soundSelected)','volumeFill.width':'$volume / 100 * 30','muteKnob.x':'$muted * 3','muteTrack.fill':'mix(#141413, #d97757, $muted)','mixedBar.visible':'$someNotifications'}
for id,prop in [('notifications','allNotifications'),('email','email'),('push','push'),('sms','sms')]: bindings[id+'Fill.visible']='$'+prop
for target,v in bindings.items():a.append(f'<bind target="{target}" value="{escape(v,quote=True)}"/>')
a+=['<layer name="actions" initial="ready"><state name="ready">', '<on when="chooseGeneral" to="ready" actions=\'{"set":{"$selectedTab":0}}\'/>','<on when="chooseSound" to="ready" actions=\'{"set":{"$selectedTab":1}}\'/>', '<on when="toggleNotifications" to="ready" actions=\'{"set":{"$email":"not ($email and $push and $sms)","$push":"not ($email and $push and $sms)","$sms":"not ($email and $push and $sms)"}}\'/>','</state></layer>']
for id,n,trigger in [('general',0,'chooseGeneral'),('sound',1,'chooseSound')]:
 a += [f'<listener on="focus" target="{id}" set="$selectedTab={n}"/>',f'<listener on="click" target="{id}" fire="{trigger}"/>']
a.append('<listener on="click" target="notifications" fire="toggleNotifications"/>')
for id,prop in [('email','email'),('push','push'),('sms','sms'),('mute','muted')]:a.append(f'<listener on="click" target="{id}" toggle="${prop}"/>')
a.append('</anima>')
(P/'settings.animl').write_text('\n'.join(a)+'\n')

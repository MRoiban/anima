from pathlib import Path
import subprocess,json,os
P=Path(__file__).resolve().parent
ROOT=P.parents[4]
CLI=['node',str(ROOT/'packages/cli/src/main.ts')]
records=[]
def run(name,args):
 r=subprocess.run(CLI+args,cwd=ROOT,text=True,capture_output=True,env={**os.environ,'CHROMIUM_PATH':str(Path.home()/'.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell')})
 (P/'evidence'/f'{name}.stdout').write_text(r.stdout)
 (P/'evidence'/f'{name}.stderr').write_text(r.stderr)
 records.append({'name':name,'args':args,'exit':r.returncode})
 (P/'evidence/runs.json').write_text(json.dumps(records,indent=2)+'\n')
 print(name,r.returncode,r.stderr[:300])
 assert r.returncode==0,(name,r.stdout,r.stderr)
 return r.stdout
FILE=str(P/'settings.animl')
ADDRESSES='$volume $muted $selectedTab $email $push $sms $generalTitle $soundTitle $volumeText generalPanel.visible soundPanel.visible generalShape.fill soundShape.fill volumeFill.width muteKnob.x notificationsFill.visible mixedBar.visible emailFill.visible pushFill.visible smsFill.visible'
SNAP='snapshot --semantics '+ADDRESSES

def sample(name,commands):
 script='\n'.join(commands)+'\n'
 (P/(name+'.txt')).write_text(script)
 out=run(name,['sample',FILE,'-s',str(P/(name+'.txt'))])
 data=[json.loads(s) for s in out.splitlines()]
 for i,s in enumerate(data):
  if 'semantics' in s:
   (P/'evidence'/f'{name}-{i:02d}-tree.json').write_text(json.dumps(s['semantics'],indent=2)+'\n')
 return data
run('validate',['validate',FILE,'--format=json'])
run('build',['build',FILE,'-o',str(P/'settings.ani')])
tabs=sample('tabs',['advance 0',SNAP,'semantic general focus',SNAP,'key down ArrowRight','key up ArrowRight','advance 0','expect $selectedTab == 1','expect soundPanel.visible == true',SNAP,'key down ArrowLeft','key up ArrowLeft','advance 0','expect $selectedTab == 0',SNAP,'semantic sound tap','expect $selectedTab == 1',SNAP,'pointer click 5 3','advance 0','expect $selectedTab == 0',SNAP,'pointer click 17 3','advance 0','expect $selectedTab == 1',SNAP])
slider=sample('slider',['advance 0','semantic sound tap','semantic volume focus',SNAP,'key down ArrowRight','key up ArrowRight','advance 0','expect $volume == 45','expect volumeFill.width ~ 13.5',SNAP,'semantic volume decrease','expect $volume == 40',SNAP,'semantic volume increase','expect $volume == 45',SNAP,'key down End','key up End','advance 0',SNAP,'semantic volume increase','expect $volume == 100','expect volumeFill.width ~ 30',SNAP,'key down Home','key up Home','advance 0',SNAP,'semantic volume decrease','expect $volume == 0','expect volumeFill.width ~ 0',SNAP])
switch=sample('switch',['advance 0','semantic sound tap',SNAP,'semantic mute focus','key down Enter','key up Enter','advance 0','expect $muted == true','expect muteKnob.x ~ 3',SNAP,'semantic mute tap','expect $muted == false','expect muteKnob.x ~ 0',SNAP,'pointer click 4 17','advance 0','expect $muted == true',SNAP])
checkbox=sample('checkbox',['advance 0',SNAP,'semantic notifications tap','expect $email == true','expect $push == true','expect $sms == true',SNAP,'semantic notifications focus','key down Space','key up Space','advance 0','expect $email == false','expect $push == false','expect $sms == false',SNAP,'semantic notifications tap','expect $email == true','expect $push == true','expect $sms == true',SNAP,'semantic email focus','key down Space','key up Space','advance 0','expect $email == false',SNAP,'semantic push tap','expect $push == false',SNAP,'semantic sms tap','expect $sms == false',SNAP,'pointer click 5 13','advance 0','expect $email == true',SNAP])
host=sample('host-data',['advance 0',SNAP,'data set $generalTitle "Overview"','data set $soundTitle "Audio"','data set $selectedTab 1','data set $volume 65','data set $muted true','advance 0','expect $volume == 65','expect volumeFill.width ~ 19.5','expect muteKnob.x ~ 3',SNAP,'data set $selectedTab 0','data set $email false','data set $push true','data set $sms true','advance 0',SNAP])
def tree(snapshot):
 d={}
 def walk(nodes):
  for n in nodes:
   d[n['id']]=n;walk(n['children'])
 walk(snapshot['semantics']);return d
assert tree(tabs[0])['general']['states']['selected'] is True
for i,selected in [(2,'sound'),(3,'general'),(4,'sound'),(5,'general'),(6,'sound')]:
 t=tree(tabs[i]);assert t[selected]['states']['selected'] is True
 assert ('volume' in t)==(selected=='sound')
 assert ('notifications' in t)==(selected=='general')
for s,val in zip(slider,[40,45,40,45,100,100,0,0]):
 n=tree(s)['volume'];assert (n['value'],n['valueText'],n['min'],n['max'],n['step'])==(val,f'Volume {val} %',0,100,5)
for s,val in zip(switch,[False,True,False,True]):assert tree(s)['mute']['states']['checked'] is val
for s,val in zip(checkbox,['mixed',True,False,True,'mixed','mixed',False,'mixed']):assert tree(s)['notifications']['states']['checked']==val
assert tree(host[1])['general']['label']=='Overview'
assert tree(host[1])['sound']['label']=='Audio'
run('render-general',['render',FILE,'-o',str(P/'evidence/general.svg')])
run('render-sound',['render',FILE,'-o',str(P/'evidence/sound.svg'),'-e','advance 0; semantic sound tap'])
run('render-all-checked',['render',FILE,'-o',str(P/'evidence/all-checked.svg'),'-e','advance 0; semantic notifications tap'])
run('render-muted',['render',FILE,'-o',str(P/'evidence/muted.svg'),'-e','advance 0; semantic sound tap; semantic mute tap; semantic volume increase'])
(P/'evidence/assertions.json').write_text(json.dumps({'ok':True,'checks':'CLI expect assertions plus independent semantic-tree assertions for all recorded interactions; mutable accessible titles; slider spoken values and clamps; panel membership; tri-state aggregation.'},indent=2)+'\n')

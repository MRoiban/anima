from pathlib import Path
import subprocess, json
root = Path(__file__).resolve().parent
runs=[]
def run(name, args):
    result=subprocess.run([str(root/'anima'),*map(str,args)],capture_output=True,text=True)
    (root/'evidence'/f'{name}.stdout').write_text(result.stdout)
    (root/'evidence'/f'{name}.stderr').write_text(result.stderr)
    runs.append({'name':name,'args':list(map(str,args)),'exit':result.returncode})
    if result.returncode: raise RuntimeError(name+': '+result.stderr+result.stdout)
    return result.stdout
source=root/'settings.animl'
run('validate',['validate',source,'--format=json'])
run('build',['build',source,'-o',root/'settings.ani'])
cases={
 'tabs': '''advance 0
focus target generalTab
snapshot --semantics --all
key down ArrowRight
advance 0
snapshot --semantics --all
expect $selectedTab == 1
expect generalPanel.visible == false
expect soundPanel.visible == true
key down ArrowLeft
advance 0
snapshot --semantics --all
expect $selectedTab == 0
pointer click 18 3
advance 0
snapshot --semantics --all
expect $selectedTab == 1
''',
 'slider': '''advance 0
data set $selectedTab 1
advance 0
focus target volumeTrack
snapshot --semantics --all
key down ArrowUp
snapshot --semantics --all
expect $volume == 45
expect volumeFill.w == 13.5
key down ArrowDown
snapshot --semantics --all
expect $volume == 40
expect volumeFill.w == 12
data set $volume 100
advance 0
snapshot --semantics --all
key down ArrowUp
snapshot --semantics --all
expect $volume == 100
expect volumeFill.w == 30
data set $volume 0
advance 0
snapshot --semantics --all
key down ArrowDown
snapshot --semantics --all
expect $volume == 0
expect volumeFill.w == 0
''',
 'switch': '''advance 0
data set $selectedTab 1
advance 0
focus target muteSwitch
snapshot --semantics --all
key down Space
snapshot --semantics --all
expect $muted == true
expect muteKnob.x == 3
key down Enter
snapshot --semantics --all
expect $muted == false
expect muteKnob.x == 0
pointer click 5 17
snapshot --semantics --all
expect $muted == true
''',
 'checkboxes': '''advance 0
focus target parent
snapshot --semantics --all
key down Space
advance 0
snapshot --semantics --all
expect $email == true
expect $push == true
expect $sms == true
expect $allChecked == true
expect mixedBar.visible == false
key down Space
advance 0
snapshot --semantics --all
expect $email == false
expect $push == false
expect $sms == false
expect $anyChecked == false
expect mixedBar.visible == false
focus target emailBox
snapshot --semantics --all
key down Space
snapshot --semantics --all
expect $email == true
expect $mixed == true
expect mixedBar.visible == true
focus target pushBox
snapshot --semantics --all
key down Enter
snapshot --semantics --all
expect $push == true
expect $mixed == true
focus target smsBox
snapshot --semantics --all
key down Space
snapshot --semantics --all
expect $sms == true
expect $allChecked == true
expect mixedBar.visible == false
pointer click 5 13
snapshot --semantics --all
expect $email == false
expect $mixed == true
''',
 'host-data': '''advance 0
data dump
data set $generalTitle "Basics"
data set $soundTitle "Audio"
advance 0
snapshot --semantics --all
expect $generalTitle == "Basics"
expect $soundTitle == "Audio"
expect label-generalTitle.visible == false
expect label-soundTitle.visible == false
data set $volume 65
data set $muted true
data set $email false
data set $push true
data set $sms true
data set $selectedTab 1
advance 0
data dump
snapshot --semantics --all
expect volumeFill.w == 19.5
expect muteKnob.x == 3
'''
}
for name, script in cases.items():
    path=root/'evidence'/f'{name}.script'
    path.write_text(script)
    stdout=run(name,['sample',source,'-s',path])
    frames=[json.loads(line) for line in stdout.splitlines() if line.strip()]
    # Independent semantic assertions, in addition to the CLI's data/geometry assertions.
    trees=[f['semantics'] for f in frames if 'semantics' in f]
    def nodes(tree):
        result={}
        for n in tree:
            result[n['id']]=n
            result.update(nodes(n.get('children',[])))
        return result
    ns=list(map(nodes,trees))
    if name=='tabs':
        assert [n['soundTab']['states']['selected'] for n in ns]==[False,True,False,True]
        assert all(n['tabs']['role']=='tab-list' for n in ns)
        assert 'parent' not in ns[1] and 'volumeTrack' not in ns[0]
    if name=='slider':
        assert [n['volumeTrack']['value'] for n in ns]==[40,45,40,100,100,0,0]
        for n in ns:
            slider=n['volumeTrack']; assert slider['role']=='slider'
            assert (slider['min'],slider['max'],slider['step'])==(0,100,5)
            assert slider['label']==f"Volume {slider['value']} %"
    if name=='switch':
        assert [n['muteSwitch']['states']['checked'] for n in ns]==[False,True,False,True]
        assert all(n['muteSwitch']['role']=='switch' and n['muteSwitch']['label']=='Mute' for n in ns)
    if name=='checkboxes':
        assert [n['parent']['states']['checked'] for n in ns]==['mixed',True,False,False,'mixed','mixed','mixed','mixed',True,'mixed']
    if name=='host-data':
        assert ns[0]['generalTab']['label']=='Basics' and ns[0]['soundTab']['label']=='Audio'
    (root/'evidence'/f'{name}.trees.json').write_text(json.dumps(trees,indent=2)+'\n')
for name, script in [('general','advance 0'),('sound','advance 0; data set $selectedTab 1; advance 0'),('all-checked','advance 0; focus target parent; key down Space; advance 0')]:
    run('render-'+name,['render',source,'-o',root/'evidence'/f'{name}.png','--size','480','-e',script])
(root/'evidence'/'runs.json').write_text(json.dumps(runs,indent=2)+'\n')
print(f'{len(runs)} CLI runs passed; independent semantic assertions passed')

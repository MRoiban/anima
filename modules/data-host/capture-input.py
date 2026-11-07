from pathlib import Path
import subprocess,shutil
root=Path.cwd()
for field,source in [('pointer-x','pointerX'),('pointer-y','pointerY'),('pointer-delta-x','pointerDeltaX'),('pointer-delta-y','pointerDeltaY'),('key-pressed','keyPressed')]:
 name='input-write-'+field; d=root/'tests/oracle'/name/'rive'; (d/'frames').mkdir(parents=True,exist_ok=True)
 string=field=='key-pressed'; typ='String' if string else 'Number'; prop=635 if string else 636
 listener='<ListenerInputTypeKeyboard listenerTypeValue="keyboard"><KeyboardInput keyType="f13" keyPhase="1"/></ListenerInputTypeKeyboard>' if string else '<ListenerInputType listenerTypeValue="move"/>'
 scene=f'''<Rive version="1" kind="fragment"><Artboard id="0:1" name="Input" width="20" height="20" defaultStateMachineId="0:10" viewModelId="0:40"><Shape id="0:20"><FocusData/><Rectangle x="0" y="0" width="20" height="20" originX="0" originY="0"/><Fill><SolidColor colorValue="FF4263EB"/></Fill></Shape><LinearAnimation id="0:4" name="idle" duration="60" fps="60"/><StateMachine id="0:10" name="input"><StateMachineListener targetId="0:20">{listener}<ListenerViewModelChange inputValue="{source}"><BindableProperty{typ} propertyValue="{'' if string else '0'}"><DataBindContext sourcePathIds="0:40-0:42" propertyKey="{prop}" direction="true"/></BindableProperty{typ}></ListenerViewModelChange></StateMachineListener><StateMachineLayer><EntryState><StateTransition stateToId="0:12"/></EntryState><AnimationState id="0:12" animationId="0:4"><FocusActionTarget targetId="0:20"/></AnimationState></StateMachineLayer></StateMachine></Artboard><ViewModel id="0:40" name="Model" defaultInstanceId="0:41"><ViewModelProperty{typ} id="0:42" name="n"/><ViewModelInstance id="0:41" name="Default" exports="true"><ViewModelInstance{typ} viewModelPropertyId="0:42" propertyValue="{'' if string else '0'}"/></ViewModelInstance></ViewModel></Rive>'''
 (d/'scene.rml').write_text(scene+'\n');(d/'rive.yaml').write_text('name: input-write\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
 script='advance 0\nadvance 0\nadvance 0\ndata-dump frames/0.json\n'
 script+= 'key f13:down\nadvance 0\ndata-dump frames/1.json\nkey f13:up\nadvance 0\ndata-dump frames/2.json\n' if string else 'pointer move@10,11\nadvance 0\ndata-dump frames/1.json\npointer move@12,8\nadvance 0\ndata-dump frames/2.json\npointer move@11,9\nadvance 0\ndata-dump frames/3.json\n'
 (d/'commands.txt').write_text(script+'quit\n')
 r=subprocess.run([str(Path.home()/'.rive/bin/rive'),'.','--commands=commands.txt'],cwd=d,capture_output=True,text=True,timeout=60);(d/'session.txt').write_text(r.stdout+r.stderr)
 print(field,r.returncode,r.stdout[-300:],flush=True)
 for f in d.rglob('*.riv'):f.unlink()
 shutil.rmtree(d/'build',ignore_errors=True)
 for f in ['AGENTS.md','CLAUDE.md','.gitignore']: (d/f).unlink(missing_ok=True)

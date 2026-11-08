"""Independent local layout-animation and responsive-viewport probes. No binary is read."""
from pathlib import Path
import shutil
import subprocess
ROOT = Path(__file__).resolve().parents[4]
CLI = str(Path.home() / '.rive/bin/rive')

def capture(folder, scene, commands, viewport=None):
    folder.mkdir(parents=True, exist_ok=True)
    (folder/'frames').mkdir(exist_ok=True)
    (folder/'scene.rml').write_text(scene)
    (folder/'rive.yaml').write_text('name: p7-layout-probe\nlogs:\n  file: build/runtime.log\n')
    (folder/'commands.txt').write_text(commands)
    try:
        result = subprocess.run([CLI, '.', '--commands=commands.txt'] + ([f'--viewport={viewport}'] if viewport else []), cwd=folder, capture_output=True, text=True)
        (folder/'session.txt').write_text((result.stdout + result.stderr).rstrip()+'\n')
        if result.returncode: raise RuntimeError(result.stdout + result.stderr)
    finally:
        for file in folder.rglob('*.riv'): file.unlink()
        shutil.rmtree(folder/'build', ignore_errors=True)

scene = '''<Rive version="1" kind="fragment">
<Artboard id="0:1" name="Reflow" width="240" height="240" viewModelId="0:400" defaultStateMachineId="0:501">
  <Fill><SolidColor colorValue="FFFFFFFF"/></Fill>
  <LayoutComponent id="0:20" name="root" width="120" height="48" styleId="0:21">
    <LayoutComponentStyle id="0:21" layoutWidthScaleType="fixed" layoutHeightScaleType="fixed" flexDirectionValue="row" animationStyleType="custom" interpolationType="linear" interpolationTime="1"/>
    <DataBindContext sourcePathIds="0:400-0:402" propertyKey="7"/>
    <Fill><SolidColor colorValue="FFD97757"/></Fill>
    <LayoutComponent id="0:30" name="child" width="24" height="24" styleId="0:31">
      <LayoutComponentStyle id="0:31" layoutWidthScaleType="fill" layoutHeightScaleType="fixed" flexShrink="0" animationStyleType="inherit"/>
      <Fill><SolidColor colorValue="FF000000"/></Fill>
    </LayoutComponent>
  </LayoutComponent>
  <LinearAnimation id="0:500" name="Hold" duration="60" fps="60"/>
  <StateMachine id="0:501" name="Main"><StateMachineLayer><EntryState><StateTransition stateToId="0:502"/></EntryState><AnimationState id="0:502" animationId="0:500"/></StateMachineLayer></StateMachine>
</Artboard>
<ViewModel id="0:400" name="Main" defaultInstanceId="0:401"><ViewModelPropertyNumber id="0:402" name="size"/><ViewModelInstance id="0:401" name="main" exports="true"><ViewModelInstanceNumber viewModelPropertyId="0:402" propertyValue="120"/></ViewModelInstance></ViewModel>
</Rive>
'''
commands = 'advance 1s\nscreenshot frames/0.png\ndata size=216\nadvance 0\nscreenshot frames/1.png\nadvance 0.5s\nscreenshot frames/2.png\ndata size=72\nadvance 0.25s\nscreenshot frames/3.png\nadvance 0.5s\nscreenshot frames/4.png\nadvance 0.5s\nscreenshot frames/5.png\nquit\n'
capture(ROOT/'tests/oracle/layout-animated-reflow/rive', scene, commands)
primed = commands.replace('data size=216\nadvance 0\n', 'data size=216\nadvance 1\n').replace('data size=72\nadvance 0.25s\n', 'advance 0.25s\ndata size=72\nadvance 1\n')
capture(ROOT/'modules/layout/verification/p7-4/primed', scene, primed)
scene = '''<Rive version="1" kind="fragment">
<Artboard id="0:1" name="Responsive" width="24" height="12" styleId="0:2">
<LayoutComponentStyle id="0:2" flexDirectionValue="row" paddingTop="2" paddingRight="2" paddingBottom="2" paddingLeft="2"/>
<Fill><SolidColor colorValue="FFFFFFFF"/></Fill>
<LayoutComponent name="child" width="1" height="1" styleId="0:21">
<LayoutComponentStyle id="0:21" layoutWidthScaleType="fill" layoutHeightScaleType="fill"/>
<Fill><SolidColor colorValue="FFFF0000"/></Fill>
</LayoutComponent>
</Artboard>
</Rive>
'''
for viewport in ['240x100', '160x80']:
    capture(ROOT/'tests/oracle/host-api-fit-layout/rive'/viewport, scene, 'fit layout\nscreenshot frames/0.png\nquit\n', viewport)

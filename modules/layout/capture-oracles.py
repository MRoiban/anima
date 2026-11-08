"""Independently author native layout styles/participants from the probe parameters.
Only local headless CLI commands are executed; no binary is inspected or converted.
"""
from pathlib import Path
import subprocess,shutil,xml.etree.ElementTree as E
from xml.sax.saxutils import escape
root=Path(__file__).resolve().parents[2]
rows='layout.containers layout.flex-direction layout.flex-justify layout.flex-align-items layout.self-alignment layout.alignment layout.spacing layout.fixed-sizing layout.hug-sizing layout.fill-sizing layout.size-bounds layout.visibility layout.participants layout.intrinsic layout.paint data.bind-layout layout.fill-bounds-difference'.split()
def attributes(values):return ' '.join(f'{k}="{escape(str(v))}"' for k,v in values.items())
def edges(s):
 v=list(map(float,str(s).split()));return [v[0],v[1] if len(v)>1 else v[0],v[2] if len(v)>2 else v[0],v[3] if len(v)>3 else v[1] if len(v)>1 else v[0]]
def main():
 for row in rows:
  name=row.replace('.','-');base=root/'tests/oracle'/name;native=base/'rive';(native/'frames').mkdir(parents=True,exist_ok=True)
  authored=E.fromstring((base/'case.animl').read_text()).find('layout'); serial=10
  def node(el):
   nonlocal serial
   serial+=10;i=serial;a=el.attrib;layout=el.tag=='layout';style={};w=a.get('layout-width',a.get('width','hug'));h=a.get('layout-height',a.get('height','hug'))
   def dim(key,value):
    mode='hug' if value=='hug' else 'fill' if value.startswith('fill') else 'fixed';style['layout'+key.title()+'ScaleType']=mode
    if mode=='fill' and '(' in value:style['fractional'+key.title()]=float(value[5:-1])
    return float(value)*12 if mode=='fixed' else 0
   if el.tag=='circle':w=h=str(2*float(a['r']))
   width=dim('width',w);height=dim('height',h)
   for key in ['min-width','max-width','min-height','max-height']:
    if key in a:
     k=key.split('-')[0]+key.split('-')[1].title();style[k]=float(a[key])*12;style[k+'UnitsValue']='points'
   if 'align-self' in a:style['alignSelfValue']={'start':'flexStart','end':'flexEnd'}.get(a['align-self'],a['align-self'])
   if a.get('display')=='none':style['displayValue']='none'
   if layout:
    style['flexDirectionValue']={'column-reverse':'columnReverse','row-reverse':'rowReverse'}.get(a.get('direction','row'),a.get('direction','row'))
    style['justifyContentValue']={'start':'flexStart','end':'flexEnd','space-between':'spaceBetween','space-around':'spaceAround','space-evenly':'spaceEvenly'}.get(a.get('justify','start'),a.get('justify','start'))
    style['layoutAlignmentType']={'layout-flex-align-items':'centerLeft','layout-flex-justify':'spaceBetweenStart','layout-alignment':'bottomRight'}.get(name,'topLeft')
    style['alignItemsValue']={'start':'flexStart','end':'flexEnd'}.get(a.get('align','start'),a.get('align','start'))
    gap=a.get('gap','0').split();style['gapHorizontal']=float(gap[-1])*12;style['gapVertical']=float(gap[0])*12
   for key in ['padding','margin']:
    if key in a:
     for side,value in zip(['Top','Right','Bottom','Left'],edges(a[key])):style[key+side]=value*12
   style['flexShrink']=0
   props={'id':f'0:{i}','name':a['id'],'width':width,'height':height,'styleId':f'0:{i+1}'}
   for key in ['x','y']:
    if key in a:props[key]=float(a[key])*12
   # Native LayoutComponent owns a background. A native leaf participant measures circle geometry.
   if el.tag=='circle':
    sizing={'layoutWidthScaleType':'hug','layoutHeightScaleType':'hug'}
    return f'<Shape name="{a["id"]}"><LayoutParticipant {attributes(sizing)}/><Ellipse width="{width}" height="{height}"/><Fill><SolidColor colorValue="FF000000"/></Fill></Shape>'
   color=a.get('fill');color=('#'+''.join(c*2 for c in color[1:])) if color and len(color)==4 else color;paint=f'<Fill><SolidColor colorValue="FF{color[1:].upper()}"/></Fill>' if color else ''
   binding='<DataBindContext sourcePathIds="0:400-0:402" propertyKey="7"/>' if name=='data-bind-layout' and a['id']=='a' else ''
   return f'<LayoutComponent {attributes(props)}><LayoutComponentStyle id="0:{i+1}" {attributes(style)}/>{binding}{paint}{"".join(node(c) for c in el if c.tag in ["layout","rect","circle"])}</LayoutComponent>'
  data=name=='data-bind-layout';board={'id':'0:1','name':'Probe','width':240,'height':240,'styleId':'0:2'}
  if data:board.update(viewModelId='0:400',defaultStateMachineId='0:501')
  machine='<LinearAnimation id="0:500" name="Hold" duration="60" fps="60"/><StateMachine id="0:501" name="Main"><StateMachineLayer><EntryState><StateTransition stateToId="0:502"/></EntryState><AnimationState id="0:502" animationId="0:500"/></StateMachineLayer></StateMachine>' if data else ''
  model='<ViewModel id="0:400" name="Main" defaultInstanceId="0:401"><ViewModelPropertyNumber id="0:402" name="size"/><ViewModelInstance id="0:401" name="main" exports="true"><ViewModelInstanceNumber viewModelPropertyId="0:402" propertyValue="24"/></ViewModelInstance></ViewModel>' if data else ''
  scene=f'<Rive version="1" kind="fragment"><Artboard {attributes(board)}><LayoutComponentStyle id="0:2"/><Fill><SolidColor colorValue="FFFFFFFF"/></Fill>{node(authored)}{machine}</Artboard>{model}</Rive>\n'
  (native/'scene.rml').write_text(scene);(native/'rive.yaml').write_text(f'name: oracle-{name}\nlogs:\n  file: build/runtime.log\n')
  (native/'commands.txt').write_text('screenshot frames/0.png\n'+('data size=60\nadvance 0\nscreenshot frames/1.png\n' if data else '')+'quit\n')
  p=subprocess.run([str(Path.home()/'.rive/bin/rive'),'.','--commands=commands.txt'],cwd=native,capture_output=True,text=True)
  (native/'session.txt').write_text(p.stdout+p.stderr)
  for f in native.rglob('*.riv'):f.unlink()
  shutil.rmtree(native/'build',ignore_errors=True)
  if p.returncode or not (native/'frames/0.png').exists():raise RuntimeError(name+': '+p.stdout+p.stderr)
  print(name,flush=True)
if __name__=='__main__':main()

"""P3b-10a: independent expected semantic projections, never executes Anima."""
import json
from pathlib import Path
root=Path('spec/conformance')
def n(id,role,states=None,actions=None,children=None,**props):
 return dict(id=id,role=role,states=states or {},bounds=[1,2,3,4],actions=actions if actions is not None else ['focus'],children=children or [],**props)
def case(name,body,trees,script,requires='a11y focus',declarations=''):
 p=root/('a11y-'+name);p.mkdir(exist_ok=True)
 (p/'case.animl').write_text(f'<anima version="0.1" name="{name}" grid="20" requires="{requires}">\n{declarations}\n{body}\n</anima>\n')
 (p/'script.txt').write_text(script)
 (p/'expected.jsonl').write_text(''.join(json.dumps(dict(time=0,values={},states={},events=[],settled=True,semantics=t),separators=(',',':'))+'\n' for t in trees))
def group(id,role,extra='',kids=''):
 return f'<group id="{id}"><a11y role="{role}" bounds="1 2 3 4" {extra}/>{kids}</group>'
case('actions-input-limits',group('slider','slider','value="amount" step="5"'),
 [[n('slider','slider',{'focused':False},['increase','decrease','focus'],value=v,min=0,max=100,step=5)] for v in [40,45,50,50,45]],
 'advance 0\nsnapshot --semantics\n'+''.join(f'semantic slider {action}\nsnapshot --semantics\n' for action in ['increase','increase','increase','decrease']),declarations='<number name="amount" default="40" min="20" max="50"/>')
roles=['button','switch','checkbox','radio','link']
body='';decls=''
for r in roles:
 decls+=f'<bool name="{r}On"/>'
 extra=f'activate="{r}On"'+(f' pressed="{r}On"' if r=='button' else f' checked="{r}On"' if r in ['switch','checkbox','radio'] else ' href="/help"')
 body+=group(r,r,extra)
body+=group('tabs','tab-list',kids=group('t1','tab')+group('skip','tab','disabled="true"')+group('t2','tab'))
def tree(stage):
 out=[]
 for r in roles:
  state={'focused':stage==r}
  if r!='link':state['pressed' if r=='button' else 'checked']=stage!='initial'
  out.append(n(r,r,state,['tap','focus'],**({'href':'/help'} if r=='link' else {})))
 tabs=[n('t1','tab',{'focused':stage=='t1'}),n('skip','tab',{'disabled':True},[]),n('t2','tab',{'focused':stage=='t2'})]
 out.append(n('tabs','tab-list',actions=[],children=tabs))
 return out
script='advance 0\nsnapshot --semantics\n'
for r in roles:
 script+=f'semantic {r} focus\n'
 key='Enter' if r in ['button','link'] else 'Space'
 script+=f'key down {key}\nkey up {key}\nexpect {r}On == true\n'
 if r=='radio': script+='key down Space\nkey up Space\nexpect radioOn == true\n'
script+='snapshot --semantics\nsemantic t1 focus\nkey down ArrowRight\nkey up ArrowRight\nsnapshot --semantics\nkey down Home\nkey down End\nkey down ArrowRight\nsnapshot --semantics\n'
case('headless-keys',body,[tree(s) for s in ['initial','link','t2','t1']],script,declarations=decls)
body='<component name="row" grid="20">'+group('item','button')+'</component><repeat id="rows" component="row" count="$n" dx="5"><focus enabled="false" edge="parent-scope"/></repeat>'
# n() already fixes bounds, so supply the translated box after construction.
def repeats(focused,count):
 out=[n(f'rows.{i}.item','button',{'focused':focused==i}) for i in range(count)]
 for i,item in enumerate(out): item['bounds']=[1+5*i,2,3,4]
 return out
case('focus-repeat',body,[repeats(None,2),repeats(0,2),repeats(1,2),repeats(0,1)],'advance 0\nsnapshot --semantics\nsemantic rows.0.item focus\nsnapshot --semantics\nkey down Tab\nkey up Tab\nsnapshot --semantics\nset $n 1\nadvance 0\nsnapshot --semantics\n',requires='a11y focus data components lists',declarations='<model name="M"><number name="n" default="2"/></model><instance name="main" model="M" default="true"/>')

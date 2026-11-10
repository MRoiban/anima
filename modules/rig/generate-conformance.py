#!/usr/bin/env python3
"""Author independent P8-1 probes. Expectations use elementary geometry, never Player output."""
import json, math, re
from pathlib import Path
from html import escape
ROOT=Path(__file__).resolve().parents[2]
def group(id,x=0,y=0,**kw):
    return dict(id=id,type='group',x=x,y=y,children=[dict(id=id+'Art',type='circle',center=[0,0],r=.35,fill={'color':'#d97757'})],**kw)
def c(kind,**kw):return dict(kind=kind,**kw)
def emit(name,nodes,expected,tracks=None,extra=None,inputs=None):
    name='rigging-'+name
    doc=dict(anima='0.1',name=name,grid=20,requires=['rig'],nodes=nodes)
    if tracks:
        doc['timelines']={'go':dict(duration=1,tracks=tracks)}
        doc['machine']={'layers':{'main':dict(initial='go',states={'go':dict(play='go')})}}
    if extra:doc.update(extra)
    if inputs:doc['requires']+=['bind'];doc['inputs']={'mix':dict(type='number',default=0)};doc['bind']={'bound.constraints.0.strength':'mix'}
    if name=='rigging-translation':
        doc['nodes'].append(group('free',constraints=[c('copyPosition',**{'from':'target'})]))
        doc['timelines']['later']={'duration':1,'tracks':{'free.constraints.0.maxX':[[0,1],[1,2]]}}
    keys=list(expected(0))
    script=[];out=[]
    for k,t in enumerate([0,.5,1]):
        if inputs:script+=['set mix '+str(t)]
        script+=['advance '+str(0 if k==0 else .5),'snapshot '+' '.join(keys)]
        out.append(dict(time=t,values=expected(t),states={'main':'go'} if tracks else {},events=[],settled=not tracks or t==1))
    folder=ROOT/'spec/conformance'/name
    (folder/'script.txt').write_text('\n'.join(script)+'\n')
    (folder/'expected.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in out))
    # Intermediate JSON is consumed by the registry-driven decompiler below; it isn't committed.
    (folder/'case.ani').write_text(json.dumps(doc,indent=2)+'\n')
    (folder/'todo.json').unlink(missing_ok=True)
    return doc

def xy(id,x,y):return {id+'.world.x':x,id+'.world.y':y}
def polar(x,y,r,theta):return x+r*math.cos(theta),y+r*math.sin(theta)
def bones(t):
    theta=t*math.pi/2;length=4+2*t
    bx,by=polar(2,5,length,theta);hx,hy=polar(bx,by,3,theta)
    return {**xy('upper',2,5),**xy('fore',bx,by),**xy('hand',hx,hy),'upper.tip.x':bx,'upper.tip.y':by,'fore.tip.x':hx,'fore.tip.y':hy,'fore.world.rotate':t*90}
emit('bone-chains',[dict(id='upper',type='bone',x=2,y=5,length=4,children=[dict(id='fore',type='bone',length=3,children=[dict(id='hand',type='circle',center=[9,5],pivot=[9,5],r=.5,fill={'color':'#000'})])])],bones,{'upper.rotate':[[0,0],[1,90]],'upper.length':[[0,4],[1,6]]})
def roots(t):
    theta=t*math.pi/2;phi=t*math.pi/6
    x,y=polar(2,4,6,theta);tx,ty=polar(x,y,2,theta+phi)
    return {**xy('root',x,y),'root.tip.x':tx,'root.tip.y':ty,'root.world.rotate':t*120}
emit('root-bones',[dict(id='outer',type='bone',x=2,y=4,length=4,children=[dict(id='root',type='bone',root=True,x=8,y=4,length=2,children=[dict(id='art',type='circle',center=[10,4],r=.5,fill={'color':'#000'})])])],roots,{'outer.rotate':[[0,0],[1,90]],'root.rotate':[[0,0],[1,30]]})
emit('constraint-order',[group('ab',constraints=[c('copyPosition',**{'from':'a'}),c('copyPosition',**{'from':'b'})]),group('ba',constraints=[c('copyPosition',**{'from':'b'}),c('copyPosition',**{'from':'a'})]),group('a',4,2),group('b',10,6)],lambda t:{**xy('ab',10,6+2*t),**xy('ba',4+2*t,2)},{'a.x':[[0,4],[1,6]],'b.y':[[0,6],[1,8]]})
emit('constraint-strength',[group('animated',2,4,constraints=[c('copyPosition',**{'from':'target'},strength=0)]),group('bound',2,4,constraints=[c('copyPosition',**{'from':'target'},strength=0)]),group('target',10,8)],lambda t:{**xy('animated',2+8*t,4+4*t),**xy('bound',2+8*t,4+4*t)},{'animated.constraints.0.strength':[[0,0],[1,1]]},inputs=True)
# Different parent spaces, mirrored factors, per-axis preservation, limits, offset, no target.
emit('translation',[group('targetParent',3,4,children0=None) if False else dict(id='targetParent',type='group',x=3,y=4,children=[group('target',2,3)]),dict(id='hostParent',type='group',x=8,y=1,children=[group('local',1,2,constraints=[c('copyPosition',**{'from':'target'},fromSpace='local',toSpace='local',factorX=-2,copyY=False,minX=-3,maxX=0)]),group('world',1,2,constraints=[c('copyPosition',**{'from':'target'},factorY=-1,minY=-6,maxY=-2)]),group('limited',1,2,constraints=[c('copyPosition',**{'from':'target'},limitSpace='local',minX=0)]),group('parentCopy',constraints=[c('copyPosition')]),group('identityCopy',constraints=[c('copyPosition',fromSpace='local',toSpace='local')]),group('offsetCopy',1,2,constraints=[c('copyPosition',**{'from':'target'},fromSpace='local',toSpace='local',offset=True)])])],lambda t:{**xy('free',5+2*t,7),**xy('local',5,3),**xy('world',5+2*t,-6),**xy('limited',8,7),**xy('parentCopy',8,1),**xy('identityCopy',8,1),**xy('offsetCopy',11+2*t,6)},{'target.x':[[0,2],[1,4]]})
emit('rotation',[dict(id='sourceParent',type='group',rotate=30,children=[group('target',rotate=10)]),dict(id='hostParent',type='group',rotate=20,children=[group('local',rotate=5,constraints=[c('copyRotation',**{'from':'target'},fromSpace='local',toSpace='local',factor=-2,offset=True,min=-45,max=0)]),group('world',constraints=[c('copyRotation',**{'from':'target'},max=50)]),group('limitLocal',constraints=[c('copyRotation',**{'from':'target'},limitSpace='local',min=-10,max=10)])])],lambda t:{'local.world.rotate':20+max(-45,5-2*(10+20*t)),'world.world.rotate':min(50,40+20*t),'limitLocal.world.rotate':30},{'target.rotate':[[0,10],[1,30]]})
emit('scale',[dict(id='sourceParent',type='group',scale=2,children=[group('target',scaleX=2,scaleY=3)]),dict(id='hostParent',type='group',scale=3,children=[group('local',scaleY=2,constraints=[c('copyScale',**{'from':'target'},fromSpace='local',toSpace='local',factorX=-1,copyY=False,minX=-4,maxX=-1)]),group('world',constraints=[c('copyScale',**{'from':'target'},factorY=-1,minY=-5)]),group('limited',constraints=[c('copyScale',**{'from':'target'},limitSpace='local',maxX=1)])])],lambda t:{'local.world.rotate':-180,'local.world.scaleX':3*(2+t),'local.world.scaleY':-6,'world.world.scaleX':4+2*t,'world.world.scaleY':-5,'limited.world.scaleX':3},{'target.scaleX':[[0,2],[1,3]]})
emit('transform',[dict(id='sourceParent',type='group',x=3,y=4,children=[dict(id='target',type='rect',x=2,y=1,x0=1,y0=2,w=4,h=2,fill={'color':'#888'})]),dict(id='hostParent',type='group',x=8,y=3,children=[group('world',constraints=[c('copyTransform',**{'from':'target'})]),group('local',constraints=[c('copyTransform',**{'from':'target'},fromSpace='local',toSpace='local')]),group('origin',constraints=[c('copyTransform',**{'from':'target'},origin=[1,1])])])],lambda t:{**xy('world',5+2*t,5),**xy('local',10+2*t,4),**xy('origin',10+2*t,9)},{'target.x':[[0,2],[1,4]]})
for name,mode in [('closer','within'),('further','beyond'),('exact','exact')]:
    def expect(t,mode=mode):
        d=2+2*t
        radius=lambda r:min(r,d) if mode=='within' else max(r,d) if mode=='beyond' else d
        return {**xy('inside',5+radius(1),5),**xy('outside',5+radius(6),5),**xy('ring',5+radius(3),5),**xy('coincident',5+(0 if mode=='within' else d),5)}
    nodes=[group('target',5,5)]+[group(id,5+r,5,constraints=[c('keepDistance',to='target',distance=2,mode=mode)]) for id,r in [('inside',1),('outside',6),('ring',3),('coincident',0)]]
    emit('distance-'+name,nodes,expect,{id+'.constraints.0.distance':[[0,2],[1,4]] for id in ['inside','outside','ring','coincident']})

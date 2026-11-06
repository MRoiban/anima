from pathlib import Path
from xml.sax.saxutils import escape
out=[]
def add(s): out.append(s)
def bind(path,key,extra=''): return f'<DataBindContext sourcePathIds="{path}" propertyKey="{key}" {extra}/>'
def path(i): return f'0:100-0:{110+i}-0:202'
def cmp(i,j=None,op='greaterThanOrEqual',value=None):
    def prop(i): return '<TransitionPropertyViewModelComparator><BindablePropertyNumber>'+bind(path(i),636)+'</BindablePropertyNumber></TransitionPropertyViewModelComparator>'
    right=prop(j) if j is not None else f'<TransitionValueNumberComparator value="{value}"/>'
    return f'<TransitionViewModelCondition opValue="{op}">'+prop(i)+right+'</TransitionViewModelCondition>'
add('<Rive version="1" kind="fragment">')
add('<Artboard name="Scoreboard" id="0:1" width="480" height="240" viewModelId="0:100" viewModelInstanceId="0:101" defaultStateMachineId="0:2" styleId="0:3"><LayoutComponentStyle id="0:3"/>')
for i,(name,score,color) in enumerate([('Ada',1250,'D97757'),('Lin',980,'6A9BCC'),('Sam',40,'788C5D')]):
    y=36+60*i
    cp=f'0:100-0:{110+i}-0:203'
    add(f'<Shape name="{name}Swatch" x="24" y="{y}"><Ellipse width="24" height="24"/><Fill><SolidColor colorValue="FF{color}">'+bind(cp,37)+'</SolidColor></Fill></Shape>')
    add(f'<Shape name="{name}Bar" x="60" y="{y}"><Rectangle width="{score*.18}" height="24" originX="0">'+bind(path(i),20,'converterId="0:300"')+f'</Rectangle><Fill><SolidColor colorValue="FF{color}">'+bind(cp,37)+f'</SolidColor></Fill><Stroke name="{name}Leader" id="0:{400+i}" thickness="6"><SolidColor colorValue="FFD97757"/></Stroke></Shape>')
add('<Shape name="Knob" id="0:10" x="285" y="216">'+bind(path(0),13,'twoWay="true" sourceToTargetRunsFirst="true" converterId="0:301"')+'<Ellipse width="24" height="24"/><Fill><SolidColor colorValue="FFD97757"/></Fill><TranslationConstraint doesCopy="false" doesCopyY="false" min="true" max="true" minValue="60" maxValue="420" minY="true" maxY="true" minValueY="216" maxValueY="216"/></Shape>')
add('<Shape name="Track" x="60" y="216"><PointsPath><StraightVertex x="0" y="0"/><StraightVertex x="360" y="0"/></PointsPath><Stroke thickness="12"><SolidColor colorValue="FF141413"/></Stroke></Shape>')
for i in range(3):
    add(f'<CustomPropertyString name="Template{i}" id="0:{500+i}" propertyValue="${{score}} pts">'+bind(f'0:100-0:{110+i}-0:205',246,'direction="true"')+'</CustomPropertyString>')
    add(f'<CustomPropertyString name="ComputedLabel{i}" propertyValue="">'+bind(f'0:100-0:{110+i}-0:205',246,f'converterId="0:{510+i}"')+bind(f'0:100-0:{110+i}-0:204',246,'direction="true"')+'</CustomPropertyString>')
add('<Event name="milestone" id="0:20"/>')
add('<StateMachine name="Scoreboard" id="0:2">')
add('<StateMachineListenerSingle targetId="0:10" listenerTypeValue="drag" name="Drag"><ListenerAlignTarget targetId="0:10" preserveOffset="false"/></StateMachineListenerSingle>')
add('<StateMachineLayer name="Leader"><AnyState x="0" y="-100"/><ExitState x="500" y="-100"/><EntryState x="0" y="0"><StateTransition stateToId="0:410"/></EntryState>')
for i in range(3):
    add(f'<AnimationState id="0:{410+i}" x="{160+i*180}" y="{(i%2)*150}" animationId="0:{420+i}">')
    for j in range(3):
        if i==j: continue
        add(f'<StateTransition stateToId="0:{410+j}" duration="0">')
        for k in range(3):
            if k!=j: add(cmp(j,k,'greaterThan' if k<j else 'greaterThanOrEqual'))
        add('</StateTransition>')
    add('</AnimationState>')
add('</StateMachineLayer>')
for i in range(3):
    add(f'<StateMachineLayer name="Label{i}"><AnyState x="0" y="-100"/><ExitState x="500" y="-100"/><EntryState x="0" y="0"><StateTransition stateToId="0:{520+i*2}"/></EntryState>')
    for high in range(2):
        add(f'<AnimationState id="0:{520+i*2+high}" animationId="0:{530+i*2+high}" x="{160+high*180}" y="{high*120}"><StateTransition stateToId="0:{520+i*2+1-high}" duration="0">'+cmp(i,op='lessThan' if high else 'greaterThanOrEqual',value=1000)+'</StateTransition></AnimationState>')
    add('</StateMachineLayer>')
add('<StateMachineLayer name="Milestone"><AnyState x="0" y="-100"/><ExitState x="500" y="-100"/><EntryState x="0" y="0"><StateTransition stateToId="0:430"/></EntryState>')
add('<AnimationState id="0:430" x="160" y="0" animationId="0:440"><StateTransition stateToId="0:431" duration="0">'+cmp(0,value=1500)+'</StateTransition></AnimationState>')
add('<AnimationState id="0:431" x="340" y="120" animationId="0:440"><StateMachineFireEvent eventId="0:20"/><StateTransition stateToId="0:430" duration="0">'+cmp(0,op='lessThan',value=1500)+'</StateTransition></AnimationState></StateMachineLayer></StateMachine>')
for i in range(3):
    add(f'<LinearAnimation name="Leader{i}" id="0:{420+i}" duration="1" fps="60">')
    for j in range(3): add(f'<KeyedObject objectId="0:{400+j}"><KeyedProperty property="thickness"><KeyFrameDouble frame="0" value="{6 if j==i else 0}"/></KeyedProperty></KeyedObject>')
    add('</LinearAnimation>')
for i in range(3):
    for high in range(2):
        template='${thousands},${remainder} pts' if high else '${score} pts'
        add(f'<LinearAnimation name="Label{i}_{high}" id="0:{530+i*2+high}" duration="1"><KeyedObject objectId="0:{500+i}"><KeyedProperty property="propertyValue"><KeyFrameString frame="0" value="{template}"/></KeyedProperty></KeyedObject></LinearAnimation>')
add('<LinearAnimation name="Idle" id="0:440" duration="1" fps="60"/></Artboard>')
add('<DataConverterRangeMapper id="0:300" name="ScoreWidth" minInput="0" maxInput="2000" minOutput="0" maxOutput="360"/>')
add('<DataConverterRangeMapper id="0:301" name="ScorePosition" minInput="0" maxInput="2000" minOutput="60" maxOutput="420" clampLower="true" clampUpper="true"/>')
add('<DataConverterToString id="0:550" round="true" decimals="0"/>')
add('<DataConverterFormula id="0:551"><FormulaTokenFunction functionType="4"/><FormulaTokenInput/><FormulaTokenOperation operationType="3"/><FormulaTokenValue operationValue="1000"/><FormulaTokenParenthesisClose/></DataConverterFormula>')
add('<DataConverterFormula id="0:552"><FormulaTokenFunction functionType="4"/><FormulaTokenInput/><FormulaTokenParenthesisClose/><FormulaTokenOperation operationType="4"/><FormulaTokenValue operationValue="1000"/></DataConverterFormula>')
add('<DataConverterStringPad id="0:553" length="3" text="0"/>')
add('<DataConverterGroup id="0:554"><DataConverterGroupItem converterId="0:551"/><DataConverterGroupItem converterId="0:550"/></DataConverterGroup>')
add('<DataConverterGroup id="0:555"><DataConverterGroupItem converterId="0:552"/><DataConverterGroupItem converterId="0:550"/><DataConverterGroupItem converterId="0:553"/></DataConverterGroup>')
for i in range(3):
    add(f'<DataConverterStringTemplate id="0:{510+i}">')
    for name,conv in [('score',550),('thousands',554),('remainder',555)]:
        add(f'<StringTemplateArgumentString name="{name}">'+bind(path(i),482,f'converterId="0:{conv}"')+'</StringTemplateArgumentString>')
    add('</DataConverterStringTemplate>')
add('<ViewModel name="Player" id="0:200" defaultInstanceId="0:210"><ViewModelPropertyString name="name" id="0:201"/><ViewModelPropertyNumber name="score" id="0:202"/><ViewModelPropertyColor name="color" id="0:203"/><ViewModelPropertyString name="label" id="0:204"/><ViewModelPropertyString name="_labelTemplate" id="0:205"/>')
for i,(name,score,color) in enumerate([('Ada',1250,'D97757'),('Lin',980,'6A9BCC'),('Sam',40,'788C5D')]):
    add(f'<ViewModelInstance name="{name}" id="0:{210+i}" exports="true"><ViewModelInstanceString viewModelPropertyId="0:201" propertyValue="{name}"/><ViewModelInstanceNumber viewModelPropertyId="0:202" propertyValue="{score}"/><ViewModelInstanceColor viewModelPropertyId="0:203" propertyValue="FF{color}"/><ViewModelInstanceString viewModelPropertyId="0:204" propertyValue="{score:,} pts"/><ViewModelInstanceString viewModelPropertyId="0:205" propertyValue="${{score}} pts"/></ViewModelInstance>')
add('</ViewModel><ViewModel name="Scoreboard" id="0:100" defaultInstanceId="0:101"><ViewModelPropertyList name="players" id="0:105"/>')
for i,name in enumerate(['ada','lin','sam']): add(f'<ViewModelPropertyViewModel name="{name}" id="0:{110+i}" viewModelReferenceId="0:200"/>')
add('<ViewModelInstance name="Default" id="0:101" exports="true"><ViewModelInstanceList viewModelPropertyId="0:105">')
for i in range(3): add(f'<ViewModelInstanceListItem viewModelId="0:200" viewModelInstanceId="0:{210+i}"/>')
add('</ViewModelInstanceList>')
for i in range(3): add(f'<ViewModelInstanceViewModel viewModelPropertyId="0:{110+i}" propertyValue="0:{210+i}"/>')
add('</ViewModelInstance></ViewModel></Rive>')
Path(__file__).with_name('scene.rml').write_text('\n'.join(out)+'\n')

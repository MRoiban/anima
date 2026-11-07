from pathlib import Path
from xml.sax.saxutils import escape

root = Path(__file__).parent
parts = ['<Rive version="1" kind="fragment">']
parts += ['''<Artboard id="0:1" name="Search card" width="480" height="360" styleId="0:2" defaultStateMachineId="0:7" viewModelId="0:100" viewModelInstanceId="0:101">
<LayoutComponentStyle id="0:2"/>
<Fill><SolidColor colorValue="FFF0EEE6"/></Fill>''']

def bind(prop, key):
    return f'<DataBindContext sourcePathIds="0:100-0:{prop}" propertyKey="{key}"/>'

def text(id, name, x, y, width, height, size, value, prop=None, color='FF141413', extra=''):
    return f'''<Text id="0:{id}" name="{name}" x="{x}" y="{y}" width="{width}" height="{height}" sizingValue="fixed" wrapValue="noWrap" overflowValue="ellipsis" originValue="top">
<TextStylePaint id="0:{id+1}" fontAssetId="0:90" fontSize="{size}"><Fill><SolidColor colorValue="{color}">{bind(115,37) if name=='Query' else ''}</SolidColor></Fill></TextStylePaint>
<TextValueRun styleId="0:{id+1}" text="{escape(value)}">{bind(prop,268) if prop else ''}</TextValueRun>{extra}</Text>'''

parts += [text(10,'Title',24,24,432,38,30,'Find a setting', extra='''
<SemanticData role="text" label="Find a setting" headingLevel="1"/>
<TextModifierGroup modifyTranslation="true" modifyOpacity="true" invertOpacity="true" y="12" opacity="0" name="Wave in">
<TextModifierRange id="0:15" modifyFrom="-0.2" falloffFrom="0" falloffTo="2" modifyTo="2" clamp="true"/>
</TextModifierGroup>''')]
parts += [text(20,'Query',36,84,408,30,21.6,'Search',114)]
parts += ['''<Shape x="24" y="72" name="Search outline"><Rectangle width="432" height="48" originX="0" originY="0" cornerRadiusTL="8" cornerRadiusTR="8" cornerRadiusBL="8" cornerRadiusBR="8"/><Stroke thickness="1.5"><SolidColor colorValue="FF141413"/></Stroke></Shape>
<LayoutComponent name="Input bounds" width="432" height="48" styleId="0:31">
<LayoutComponentStyle id="0:31" positionTypeValue="absolute" positionLeft="24" positionTop="72" positionLeftUnitsValue="points" positionTopUnitsValue="points"/>
<ScriptedLayout scriptAssetId="0:91" name="Search controller">
<FocusData/>
<SemanticData role="textField" label="Search" hint="Type to filter; Backspace deletes; Escape clears.">'''+bind(110,984)+'''</SemanticData>
</ScriptedLayout></LayoutComponent>''']
labels = ['Notifications','Network and connectivity preferences','Sound','Display brightness and colour','Privacy']
for i,label in enumerate(labels,1):
    extra = f'<SemanticData role="text" label="{label}">{bind(120+i,983)}{bind(140+i,1004)}</SemanticData>'+bind(130+i,18)
    parts += [text(200+i*10,f'Row {i}',24,144+(i-1)*36,168,30,21.6,label,120+i,extra=extra)]
parts += [text(40,'Count',24,324,432,30,21.6,'5 results',113,extra='<SemanticData role="text">'+bind(113,983)+'</SemanticData>')]
parts += ['''<StateMachine id="0:7" name="Search">
<StateMachineLayer><AnyState x="0" y="-100"/><ExitState x="300" y="-100"/>
<EntryState x="0" y="0"><StateTransition stateToId="0:8"/></EntryState>
<AnimationState id="0:8" x="200" y="0" animationId="0:9"/></StateMachineLayer></StateMachine>
<LinearAnimation id="0:9" name="Title arrival" fps="60" duration="66">
<KeyedObject objectId="0:15">
<KeyedProperty property="modifyFrom"><KeyFrameDouble value="-0.2" frame="0" interpolationType="linear"/><KeyFrameDouble value="1" frame="66" interpolationType="linear"/></KeyedProperty>
<KeyedProperty property="falloffFrom"><KeyFrameDouble value="0" frame="0" interpolationType="linear"/><KeyFrameDouble value="1.2" frame="66" interpolationType="linear"/></KeyedProperty>
</KeyedObject></LinearAnimation></Artboard>
<FontAsset id="0:90" name="Anima Test" file="anima-test.ttf"/>
<ScriptAsset id="0:91" name="Controller" file="controller.luau"/>
<ViewModel id="0:100" name="SearchData" defaultInstanceId="0:101">''']
props = [(110,'String','query',''),(112,'Number','count','5'),(113,'String','countText','5 results'),(114,'String','fieldText','Search'),(115,'Color','fieldColor','FF787873')]
for i,label in enumerate(labels,1):
    props += [(120+i,'String',f'label{i}',label),(130+i,'Number',f'opacity{i}','1'),(140+i,'Boolean',f'hidden{i}','false')]
for id,kind,name,value in props:
    parts += [f'<ViewModelProperty{kind} id="0:{id}" name="{name}"/>']
parts += ['<ViewModelInstance id="0:101" name="Default" exports="true">']
for id,kind,name,value in props:
    parts += [f'<ViewModelInstance{kind} viewModelPropertyId="0:{id}" propertyValue="{escape(value)}"/>']
parts += ['</ViewModelInstance></ViewModel></Rive>']
(root/'scene.rml').write_text('\n'.join(parts)+'\n')

"""[P3b-9] Authored logical-tree/action probe. No native binary is consumed."""
from pathlib import Path
p=Path('modules/a11y/oracle/roles/actions');p.mkdir(exist_ok=True)
roles='button checkbox switch radio radio-group slider tab tab-list link list list-item group dialog alert-dialog text img'.split()
native={'switch':'switchControl','radio':'radioButton','radio-group':'radioGroup','tab-list':'tabList','list-item':'listItem','alert-dialog':'alertDialog','img':'image'}
fields={'button':('isToggled',1000,'isToggleable'),'checkbox':('isChecked',998,'isCheckable'),'switch':('isToggled',1000,'isToggleable'),'radio':('isChecked',998,'isCheckable'),'tab':('isSelected',997,'isSelectable'),'group':('isExpanded',996,'isExpandable'),'radio-group':('isDisabled',1002,'isEnablable')}
s='<Rive version="1" kind="fragment"><Artboard id="0:1" name="Actions" width="240" height="240" viewModelId="0:40" defaultStateMachineId="0:2"><FocusData canFocus="false"/>'
for i,role in enumerate(roles):
    binds='';traits=''
    if role in fields:
        attr,key,trait=fields[role];traits=f' {trait}="true"'
        prop=43 if attr=='isChecked' else 42
        binds+=f'<DataBindContext sourcePathIds="0:40-0:{prop}" propertyKey="{key}"/>'
    if role=='slider':binds+='<DataBindContext sourcePathIds="0:40-0:44" propertyKey="984"/>'
    s+=f'<Shape id="0:{20+i}" name="{role}" x="20" y="{10+12*i}"><SemanticData role="{native.get(role,role)}" label="{role}"{traits}>{binds}</SemanticData><Rectangle width="4" height="4"/><Fill><SolidColor colorValue="FF111111"/></Fill></Shape>'
s+='<LinearAnimation id="0:3" name="Idle" duration="60" fps="60"/><StateMachine id="0:2" name="Actions">'
def change(prop,typ,key,value):return f'<ListenerViewModelChange><BindableProperty{typ} propertyValue="{value}"><DataBindContext sourcePathIds="0:40-0:{prop}" propertyKey="{key}" direction="true"/></BindableProperty{typ}></ListenerViewModelChange>'
for target,action,changes in [(20,'tap',change(42,'Boolean',634,'true')+change(43,'Number',636,'1')),(25,'increase',change(44,'String',635,'45')),(25,'decrease',change(44,'String',635,'40'))]:
    s+=f'<StateMachineListener targetId="0:{target}"><ListenerInputTypeSemantic listenerTypeValue="semanticAction"><SemanticInput actionType="{action}"/></ListenerInputTypeSemantic>{changes}</StateMachineListener>'
s+='<StateMachineLayer><EntryState><StateTransition stateToId="0:4"/></EntryState><AnimationState id="0:4" animationId="0:3"><FocusActionTarget targetId="0:20"/></AnimationState></StateMachineLayer></StateMachine></Artboard><ViewModel id="0:40" name="State" defaultInstanceId="0:41"><ViewModelPropertyBoolean id="0:42" name="flag"/><ViewModelPropertyNumber id="0:43" name="check"/><ViewModelPropertyString id="0:44" name="speech"/><ViewModelInstance id="0:41" name="main" exports="true"><ViewModelInstanceBoolean viewModelPropertyId="0:42" propertyValue="false"/><ViewModelInstanceNumber viewModelPropertyId="0:43" propertyValue="0"/><ViewModelInstanceString viewModelPropertyId="0:44" propertyValue="40"/></ViewModelInstance></ViewModel></Rive>\n'
(p/'scene.rml').write_text(s)
(p/'rive.yaml').write_text('name: anima-semantic-actions\n')
(p/'frames').mkdir(exist_ok=True)
(p/'commands.txt').write_text('advance 0\nsemantics frames/before.json\nsemantic-action tap@button\nadvance 0\nadvance 0\nsemantics frames/tap.json\nsemantic-action increase@slider\nadvance 0\nadvance 0\nsemantics frames/increase.json\nsemantic-action decrease@slider\nadvance 0\nadvance 0\nsemantics frames/decrease.json\nquit\n')

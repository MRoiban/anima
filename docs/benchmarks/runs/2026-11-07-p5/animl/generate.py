from pathlib import Path
import xml.etree.ElementTree as ET
p=Path('docs/benchmarks/runs/2026-11-07-p5/animl');p.mkdir(parents=True,exist_ok=True)
lib='''<library name="toolbar-ui">
  <template name="press">
    <bool name="hover"/>
    <bool name="down"/>
    <listener on="enter" set="hover=true"/>
    <listener on="leave" set="hover=false down=false"/>
    <listener on="down" set="down=true"/>
    <listener on="up" set="down=false"/>
    <layer name="press" initial="rest">
      <state name="rest">
        <pose icon.scale="1"/>
        <on when="down" to="pressed" blend="0.08"/>
        <on when="hover" to="hovered" blend="0.12"/>
      </state>
      <state name="hovered">
        <pose icon.scale="1.06"/>
        <on when="down" to="pressed" blend="0.08"/>
        <on when="!hover" to="rest" blend="0.12"/>
      </state>
      <state name="pressed">
        <pose icon.scale="0.92"/>
        <on when="!down and hover" to="hovered" blend="0.12"/>
        <on when="!down and !hover" to="rest" blend="0.12"/>
      </state>
    </layer>
  </template>
</library>
'''
(p/'ui.animl').write_text(lib)
s=['<anima version="0.1" name="toolbar" grid="20" viewBox="0 0 72 24" requires="components bind">', '  <import src="ui.animl" as="ui"/>', '  <number name="unread" default="3" min="0" max="9"/>', '  <number name="trash" default="0" min="0" max="9"/>']
for glyph in ['bell','folder','trash']:
    d=ET.parse('fixtures/glyphs/'+glyph+'.svg').getroot()[0].attrib['d']
    s += [f'  <component name="{glyph}-button" grid="20">',f'    <glyph name="art" d="{d}"/>','    <group id="icon" pivot="10 10">','      <path id="art" glyph="art" fill="#141413" fill-rule="evenodd"/>','    </group>','    <apply template="ui:press"/>','    <listener on="click" emit="selected"/>','  </component>']
s += ['  <component name="badge" grid="8">','    <number name="count" default="0" min="0" max="9"/>','    <group id="badge" pivot="4 4">','      <circle id="disc" cx="4" cy="4" r="3.5" fill="#d97757"/>']
for n in range(1,4): s += [f'      <circle id="dot{n}" cx="{n+2}" cy="4" r="0.5" fill="#ffffff"/>']
s += ['    </group>']
for n in range(1,4):s += [f'    <bind target="dot{n}.opacity" value="clamp(count - {n-1}, 0, 1)"/>']
s += ['    <timeline name="pop" duration="0.25" loop="once">','      <track target="badge.scale">0 1; 0.125 1.25; 0.25 1</track>','    </timeline>','    <layer name="count-motion" initial="boot">','      <state name="boot">','        <pose/>']
for n in range(10):s += [f'        <on when="count == {n}" to="count{n}"/>']
s+=['      </state>']
for n in range(10):
    for rising in [False,True] if n else [False]:
        name=('rise' if rising else 'count')+str(n)
        s += [f'      <state name="{name}"'+(' play="pop">' if rising else '>')]
        if not rising:s += [f'        <pose badge.scale="1" badge.visible="{str(n!=0).lower()}"/>']
        for m in range(10):
            if n!=m:s += [f'        <on when="count == {m}" to="'+('rise' if m>n else 'count')+f'{m}"/>']
        if rising:s += [f'        <on when="@end" to="count{n}"/>']
        s+=['      </state>']
s += ['    </layer>','  </component>','  <instance id="bell" component="bell-button" x="2" y="2"/>','  <instance id="folder" component="folder-button" x="26" y="2"/>','  <instance id="trash-button" component="trash-button" x="50" y="2"/>','  <instance id="bell-badge" component="badge" x="17" y="2" count="{unread}"/>','  <instance id="trash-badge" component="badge" x="65" y="2" count="{trash}"/>','  <listener on="bell.selected" set="unread=0"/>','</anima>']
(p/'toolbar.animl').write_text('\n'.join(s)+'\n')

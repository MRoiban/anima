from pathlib import Path
from xml.sax.saxutils import escape

here = Path(__file__).resolve().parent
labels = ['Notifications', 'Network and connectivity preferences', 'Sound', 'Display brightness and colour', 'Privacy']
lines = ['<anima version="0.1" name="search-card" grid="40" viewBox="0 0 40 30" requires="text texteffects textinput focus a11y input data bind derive convert">',
'  <model name="Search">', '    <string name="query"/>']
for i, label in enumerate(labels):
    lines += [f'    <string name="label{i}" default="{escape(label)}"/>', f'    <bool name="shown{i}" default="true"/>', f'    <number name="n{i}" value="$shown{i}"/>']
lines += ['    <number name="count" value="$n0 + $n1 + $n2 + $n3 + $n4"/>', '    <string name="countText" value="$count" convert="resultCount"/>', '  </model>',
'  <instance name="main" model="Search" default="true" export="true"/>',
'  <converter name="resultCount" type="template" text="{0} results"/>',
'  <text-style id="body" font="sans-serif" size="1.8" line-height="1" fill="#141413"/>',
'  <text-style id="muted" font="sans-serif" size="1.8" line-height="1" fill="#777670"/>',
'  <text-style id="heading" font="sans-serif" size="2.5" line-height="1" fill="#141413"/>',
'  <rect id="panel" x0="0" y0="0" width="40" height="30" fill="#f0eee6"/>',
'  <text id="title" x="2" y="2"><run text="Find a setting" style="heading"/><text-effect y="1" opacity="0" start="0" end="20" falloff="3" units="glyphs"/></text>',
'  <rect id="fieldBox" x0="2" y0="6" width="36" height="4" rx="0.7" stroke="#141413" stroke-width="0.12"/>',
'  <text id="search" x="2.8" y="7.1" width="34.4" height="2.5" sizing="fixed" wrap="false"><run text="" style="body"/><text-input label="Search" write-text="$query" caret-color="#d97757" selection-color="#d9775755"/></text>',
'  <text id="placeholder" x="2.8" y="7.1" pointerEnabled="false"><run text="Search" style="muted"/><a11y role="none"/></text>',
'  <bind target="placeholder.visible" value="$query == &quot;&quot;"/>']
for i in range(5):
    lines += [f'  <text id="row{i}" x="2" y="{12+i*3}" width="14" height="2.5" sizing="fixed" wrap="false" overflow="ellipsis"><run text="$label{i}" style="body"/><a11y role="text" label="$label{i}"/></text>', f'  <bind target="row{i}.collapsed" value="not $shown{i}"/>']
lines += ['  <text id="countLine" x="2" y="27"><run text="$countText" style="body"/><a11y role="status" label="$countText"/></text>',
'  <timeline name="wave" duration="1.1" reducedMotion="end"><track target="title.effects.0.start">0 0; 1.1 17</track></timeline>', '  <layer name="intro" initial="enter"><state name="enter" play="wave"/></layer>', '</anima>']
(here / 'search.animl').write_text('\n'.join(lines) + '\n')

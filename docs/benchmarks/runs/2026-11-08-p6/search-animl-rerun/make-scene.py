from pathlib import Path
from xml.sax.saxutils import escape
out = Path(__file__).parent
labels = ['Notifications', 'Network and connectivity preferences', 'Sound', 'Display brightness and colour', 'Privacy']
lines = ['<anima version="0.1" name="search-card" grid="40" viewBox="0 0 40 30" requires="text texteffects textinput a11y focus data bind derive convert">', '  <model name="Search">', '    <string name="query"/>']
for i, label in enumerate(labels):
    lines.append(f'    <string name="label{i}" default="{escape(label)}"/>')
for i in range(5):
    lines.append(f'    <bool name="shown{i}" value="contains(lower($label{i}), lower($query))"/>')
lines += ['    <number name="count" value="$shown0 + $shown1 + $shown2 + $shown3 + $shown4"/>', '    <string name="summary" value="$count" convert="results"/>', '  </model>', '  <instance name="main" model="Search" default="true" export="true"/>', '  <converter name="results" type="template" text="{0} results"/>', '  <text-style id="body" font="sans-serif" size="1.8" line-height="1" fill="#141413"/>', '  <text-style id="heading" font="sans-serif" size="2.5" line-height="1" fill="#141413"/>', '  <rect id="panel" x0="0" y0="0" width="40" height="30" fill="#f0eee6"/>', '  <text id="title" x="2" y="2">', '    <run text="Find a setting" style="heading"/>']
for i in range(len('Find a setting')):
    lines.append(f'    <text-effect start="{i}" end="{i+1}" units="glyphs" y="1" opacity="0"/>')
lines += ['  </text>', '  <rect id="field-box" x0="2" y0="6" width="36" height="4" rx="0.7" fill="#f0eee6" stroke="#141413" stroke-width="0.12"/>', '  <rect id="accent" x0="3" y0="9.5" width="34" height="0.08" fill="#d97757"/>', '  <text id="search" x="2.7" y="7" width="34.6" height="2" sizing="fixed" wrap="false">', '    <style id="field" font="sans-serif" size="1.8" line-height="1" fill="#141413"/>', '    <run text="" style="field"/>', '    <text-input placeholder="Search" label="Search" write-text="$query" caret-color="#d97757"/>', '  </text>', '  <bind target="search.opacity" value="0.5 + 0.5 * ($query != &quot;&quot;)"/>']
for i in range(5):
    lines += [f'  <text id="row{i}" x="2" y="{12+i*3}" width="14" height="2.5" sizing="fixed" wrap="false" overflow="ellipsis">', f'    <run text="$label{i}" style="body"/>', f'    <a11y role="text" label="$label{i}"/>', '  </text>', f'  <bind target="row{i}.visible" value="$shown{i}"/>']
lines += ['  <text id="total" x="2" y="27">', '    <run text="$summary" style="body"/>', '    <a11y role="text" label="$summary"/>', '  </text>', '  <timeline name="wave" duration="1.1" reducedMotion="end">']
for i in range(len('Find a setting')):
    start = i * .05
    for prop, initial in [('y',1), ('opacity',0)]:
        final = 0 if prop == 'y' else 1
        keys = f'0 {initial}; '
        if start:
            keys += f'{start:.2f} {initial} out; '
        keys += f'{start+.35:.2f} {final}'
        lines.append(f'    <track target="title.effects.{i}.{prop}">{keys}</track>')
lines += ['  </timeline>', '  <layer name="load" initial="enter">', '    <state name="enter" play="wave"/>', '  </layer>', '</anima>']
(out / 'search.animl').write_text('\n'.join(lines)+'\n')

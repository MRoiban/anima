"""Check measured CLI semantic bounds, not authored dimensions or pixels."""
import json
from pathlib import Path

root = Path(__file__).parent / 'evidence'

def geometry(name):
    tree = json.loads((root / f'{name}.semantics.json').read_text())
    result = {}
    def walk(node):
        result[node['label']] = node['bounds']
        for child in node['children']:
            walk(child)
    for node in tree['roots']:
        walk(node)
    return result

def near(a, b):
    assert abs(a-b) < 0.001, (a, b)

base = geometry('baseline')
near(base['Button']['width'], base['Button label']['width'] + 24)
near(base['Button']['height'], base['Button label']['height'] + 12)
near(base['Title']['x'], 18)
near(base['Button']['y'] - base['Title']['y'] - base['Title']['height'], 12)
near(base['Chips row']['y'] - base['Button']['y'] - base['Button']['height'], 12)

summary = {}
for prefix, count in [('growth',20), ('shrink',20), ('interrupted-growth',9), ('interrupted-shrink',9), ('reversal',20)]:
    sizes = [geometry(f'{prefix}-{i:02}')['Button']['width'] for i in range(count+1)]
    changes = [b-a for a,b in zip(sizes,sizes[1:])]
    assert all(abs(d) < 4.802 for d in changes), (prefix, changes)
    assert all(d >= -0.001 for d in changes) if prefix in ('growth','interrupted-growth','reversal') else all(d <= 0.001 for d in changes)
    if count == 20:
        near(sizes[18], sizes[20])
    summary[prefix] = {'start':sizes[0], '150ms':sizes[9], '300ms':sizes[18] if count==20 else None, 'widthsPerFrame':sizes}
# Data writes consume a frame: each interruption starts one old-direction step later.
near(summary['interrupted-shrink']['start'], summary['interrupted-growth']['150ms'] + (summary['growth']['300ms']-summary['growth']['start'])/18)
near(summary['reversal']['start'], summary['interrupted-shrink']['150ms'] + (summary['shrink']['300ms']-summary['interrupted-shrink']['start'])/18)
near(summary['growth']['300ms'], geometry('growth-20')['Button label']['width']+24)
near(summary['shrink']['300ms'], base['Button']['width'])

for name in ['baseline','chip1-long','chip3-hidden','layout-480x360','layout-600x300']:
    g = geometry(name)
    labels = ['Chip 1','Chip 2'] + (['Chip 3'] if 'Chip 3' in g else [])
    near(g['Chips row']['width'], sum(g[k]['width'] for k in labels) + 6*(len(labels)-1))
    near(g['Chips row']['width'], g['Card']['width']-36)
    for a,b in zip(labels,labels[1:]):
        near(g[b]['x'] - g[a]['x'] - g[a]['width'],6)
    for label in ['Chip 1','Chip 3']:
        if label in g:
            near(g[label]['width'],g[label+' label']['width']+24)
    summary[name] = g
assert geometry('chip1-long')['Chip 2']['width'] < base['Chip 2']['width']
assert 'Chip 3' not in geometry('chip3-hidden')
assert geometry('chip3-hidden')['Chip 2']['width'] > geometry('chip1-long')['Chip 2']['width']
for size in ['480x360','600x300']:
    w,h = map(int,size.split('x'))
    g = geometry('layout-'+size)
    near(g['Card']['width'],w)
    near(g['Card']['height'],h)
    # Contain keeps the authored artboard; capture dimensions verify host size.
    g = geometry('contain-'+size)
    near(g['Card']['width'],480)
    near(g['Card']['height'],360)
assert geometry('title-updated')['Title']['width'] != base['Title']['width']
assert json.loads((root/'inspect-03.json').read_text())['problems'] == []
(root/'geometry-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print('PASS: six brief items; semantic geometry, per-frame continuity, 18-frame duration, hide, host reflow, title data binding.')

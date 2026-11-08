from pathlib import Path
import json
import xml.etree.ElementTree as ET

here = Path(__file__).resolve().parent
ns = {'s': 'http://www.w3.org/2000/svg'}

def texts(name):
    root = ET.fromstring((here / 'evidence' / name).read_text())
    return [''.join(node.itertext()) for node in root.findall('.//s:text', ns)]

original = texts('text.svg')
renamed = texts('renamed.svg')
assert 'Network and …' in original
assert 'Display brig…' in original
assert 'Sound' in original
assert 'Audio' in renamed
assert 'Privacy' not in renamed
assert '5 results' in original
assert 'Search' in original
result = {'original_rendered_text': original, 'renamed_rendered_text': renamed,
          'assertions': 'PASS: long rows ellipsized, unchanged short row, data rename changes drawn text, count and placeholder present'}
(here / 'evidence' / 'svg-assertions.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(result['assertions'])

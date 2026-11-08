"""Generate portable headless commands; invoke the CLI from this directory."""
from pathlib import Path
p = Path(__file__).parent
commands = ['fit contain', 'viewport 480x360', 'advance 60']

def sample(name, screenshot=False):
    commands.extend([f'semantics evidence/{name}.semantics.json', f'data-dump evidence/{name}.data.json'])
    if screenshot:
        commands.append(f'screenshot evidence/{name}.png')

def frames(prefix, count):
    sample(f'{prefix}-00')
    for i in range(1, count + 1):
        commands.append('advance 1')
        sample(f'{prefix}-{i:02}')

sample('baseline', True)
commands.append('data buttonLabel=Save changes')
frames('growth', 20)
commands.append('data buttonLabel=Save')
frames('shrink', 20)
commands.append('data buttonLabel=Save changes')
frames('interrupted-growth', 9)
commands.append('data buttonLabel=Save')
frames('interrupted-shrink', 9)
commands.append('data buttonLabel=Save changes')
frames('reversal', 20)
commands.extend(['data chip1Label=Longer first chip', 'advance 30'])
sample('chip1-long', True)
commands.extend(['data hideChip3=true', 'advance 30'])
sample('chip3-hidden', True)
commands.extend(['data hideChip3=false', 'data chip1Label=One', 'data buttonLabel=Save', 'advance 60'])
sample('contain-480x360', True)
commands.extend(['viewport 600x300', 'advance 30'])
sample('contain-600x300', True)
commands.extend(['fit layout', 'advance 30'])
sample('layout-600x300', True)
commands.extend(['viewport 480x360', 'advance 30'])
sample('layout-480x360', True)
commands.extend(['data title=Updated title', 'advance 30'])
sample('title-updated', True)
commands.append('quit')
(p / 'proof.commands').write_text('\n'.join(commands) + '\n')

import datetime
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
args = sys.argv[1:]
result = subprocess.run(['node', 'packages/cli/src/main.ts', *args], capture_output=True, text=True)
log = HERE / 'evidence' / 'commands.jsonl'
previous = log.read_text().splitlines() if log.exists() else []
number = len(previous) + 1
(HERE / 'evidence' / f'{number:02d}-{args[0]}.txt').write_text(result.stdout + result.stderr)
with log.open('a') as stream:
    stream.write(json.dumps({'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'args': args, 'exit': result.returncode}) + '\n')
print(result.stdout, end='')
print(result.stderr, end='', file=sys.stderr)
sys.exit(result.returncode)

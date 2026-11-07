import datetime
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
args = sys.argv[2:]
result = subprocess.run(['node', 'packages/cli/src/main.ts', *args], text=True, capture_output=True)
record = {'time': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'args': args, 'exit': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
with (ROOT / 'evidence/runs.jsonl').open('a') as log:
    log.write(json.dumps(record) + '\n')
(ROOT / 'evidence' / sys.argv[1]).write_text(result.stdout + result.stderr)
print(result.stdout, end='')
print(result.stderr, end='', file=sys.stderr)
sys.exit(result.returncode)

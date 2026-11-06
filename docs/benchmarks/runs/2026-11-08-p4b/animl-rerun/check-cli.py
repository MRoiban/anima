"""Run a CLI check and retain its exact output and exit status for the benchmark."""
import datetime
import json
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
args = sys.argv[1:]
p = subprocess.run(['node', 'packages/cli/src/main.ts', *args], capture_output=True, text=True)
with (HERE / 'runs.jsonl').open('a') as f:
    f.write(json.dumps(dict(time=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                           args=args, code=p.returncode, stdout=p.stdout, stderr=p.stderr)) + '\n')
print(p.stdout, end='')
print(p.stderr, end='', file=sys.stderr)
sys.exit(p.returncode)

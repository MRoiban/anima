"""Run one benchmark CLI check, preserving stdout, stderr and an invocation ledger."""
import datetime
import json
import subprocess
import sys
from pathlib import Path

here = Path(__file__).resolve().parent
label, *args = sys.argv[1:]
result = subprocess.run(['node', 'packages/cli/src/main.ts', *args], capture_output=True, text=True)
(here / (label + '.stdout')).write_text(result.stdout)
(here / (label + '.stderr')).write_text(result.stderr)
with (here / 'checks.jsonl').open('a') as out:
    out.write(json.dumps(dict(label=label, utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        args=args, exit=result.returncode)) + '\n')
print(label, 'exit', result.returncode)
print(result.stdout, end='')
print(result.stderr, end='', file=sys.stderr)
sys.exit(result.returncode)

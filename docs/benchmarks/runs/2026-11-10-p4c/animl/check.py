"""Record every benchmark validate/inspect/sample/render/build invocation."""
import datetime, json, pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parent
args = sys.argv[1:]
p = subprocess.run(['node', 'packages/cli/src/main.ts', *args], text=True, capture_output=True)
record = dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(), args=args, exit=p.returncode, stdout=p.stdout, stderr=p.stderr)
with (root / 'checks.jsonl').open('a') as f:
    f.write(json.dumps(record) + '\n')
print(p.stdout, end='')
print(p.stderr, end='', file=sys.stderr)
sys.exit(p.returncode)

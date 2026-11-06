"""Run one CLI check, retaining stdout/stderr and an append-only invocation ledger."""
import datetime, json, pathlib, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent
ledger = HERE / 'evidence' / 'checks.jsonl'
previous = ledger.read_text().splitlines() if ledger.exists() else []
number = len(previous) + 1
result = subprocess.run(['node', 'packages/cli/src/main.ts', *sys.argv[1:]], capture_output=True, text=True)
stem = f'{number:02d}-{sys.argv[1]}'
(HERE / 'evidence' / f'{stem}.stdout').write_text(result.stdout)
(HERE / 'evidence' / f'{stem}.stderr').write_text(result.stderr)
with ledger.open('a') as stream:
    stream.write(json.dumps(dict(n=number, at=datetime.datetime.now().astimezone().isoformat(), args=sys.argv[1:], exit=result.returncode, stdout=f'{stem}.stdout', stderr=f'{stem}.stderr')) + '\n')
print(result.stdout, end='')
print(result.stderr, end='', file=sys.stderr)
sys.exit(result.returncode)

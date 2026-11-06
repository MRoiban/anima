"""Run one CLI check, persist its complete output and append an audit record."""
from pathlib import Path
import datetime, json, subprocess, sys
root = Path(__file__).parent
ledger = root/'evidence/checks.jsonl'
records = ledger.read_text().splitlines() if ledger.exists() else []
args = sys.argv[1:]
result = subprocess.run(['node','packages/cli/src/main.ts',*args],capture_output=True,text=True)
name = f'{len(records)+1:02d}-{args[0]}'
(root/f'evidence/{name}.txt').write_text(result.stdout+result.stderr)
with ledger.open('a') as f:
    f.write(json.dumps(dict(run=len(records)+1,at=datetime.datetime.now().astimezone().isoformat(),args=args,exit=result.returncode,output=name+'.txt'))+'\n')
print(result.stdout+result.stderr,end='')
sys.exit(result.returncode)

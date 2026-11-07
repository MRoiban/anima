import subprocess,sys,json,time,pathlib
root=pathlib.Path(__file__).resolve().parent
args=sys.argv[1:]
p=subprocess.run(['node','packages/cli/src/main.ts',*args],capture_output=True,text=True)
log=root/'evidence/checks.jsonl'
old=log.read_text().splitlines() if log.exists() else []
n=len(old)+1
(root/f'evidence/check-{n:03}.txt').write_text(p.stdout+p.stderr)
with log.open('a') as f:f.write(json.dumps(dict(n=n,args=args,exit=p.returncode,time=time.time()))+'\n')
print(p.stdout+p.stderr,end='')
sys.exit(p.returncode)

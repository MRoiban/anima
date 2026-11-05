"""CLI evidence runner; execute from repo root. All invocations append to runs.jsonl."""
import json
from pathlib import Path
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
args = sys.argv[1:]
result = subprocess.run(["node", "packages/cli/src/main.ts", *args], capture_output=True, text=True)
with (HERE / "runs.jsonl").open("a") as log:
    log.write(json.dumps(dict(time=time.time(), args=args, code=result.returncode,
                             stdout=result.stdout, stderr=result.stderr)) + "\n")
sys.stdout.write(result.stdout)
sys.stderr.write(result.stderr)
sys.exit(result.returncode)

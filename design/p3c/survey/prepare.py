"""Make an isolated, disposable source archive; never point workspace packages at the real tree."""

import io
import os
from pathlib import Path
import subprocess
import sys
import tarfile

repo = Path.cwd()
scratch = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/p3c-survey-scratch")
if scratch.exists():
    raise SystemExit(f"Refusing to overwrite {scratch}; use a fresh directory")
scratch.mkdir(parents=True)
archive = subprocess.check_output(["git", "archive", "HEAD"])
with tarfile.open(fileobj=io.BytesIO(archive)) as source:
    source.extractall(scratch, filter="data")
node = scratch / "node_modules"
node.mkdir()
for dependency in (repo / "node_modules").iterdir():
    if dependency.name == "@anima-format":
        scope = node / dependency.name
        scope.mkdir()
        for package in dependency.iterdir():
            os.symlink(scratch / "packages" / package.name, scope / package.name)
    else:
        os.symlink(dependency, node / dependency.name)
print(scratch)

"""Recapture original-font text probes through the permitted local headless CLI only."""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
for name in sys.argv[1:]:
    if Path(name).name != name or not name.startswith(("text-", "assets-font", "data-bind-text", "data-property-text-style")):
        raise ValueError(name)
    project = ROOT / name / "rive"
    try:
        result = subprocess.run(
            [str(Path.home() / ".rive/bin/rive"), ".", "--commands=commands.txt"],
            cwd=project, capture_output=True, text=True, timeout=60,
        )
        (project / "session.txt").write_text(result.stdout + result.stderr)
        print(name, result.returncode, flush=True)
        result.check_returncode()
    finally:
        # Generated proprietary output is deleted without opening or converting it.
        shutil.rmtree(project / "build", ignore_errors=True)
        for binary in project.rglob("*.riv"):
            binary.unlink()

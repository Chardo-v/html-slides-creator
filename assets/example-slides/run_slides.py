#!/usr/bin/env python3

from pathlib import Path
import subprocess
import sys


SLIDES_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SLIDES_DIR.parents[2]
SERVER = SKILL_ROOT / "scripts" / "server.py"

try:
    subprocess.run([sys.executable, str(SERVER), str(SLIDES_DIR), *sys.argv[1:]], check=False)
except KeyboardInterrupt:
    pass

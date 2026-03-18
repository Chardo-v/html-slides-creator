#!/usr/bin/env python3
# 模板文件：复制到用户的 slides 目录后，将 SKILL_ROOT 改为
# html-slides-creator 的实际绝对路径（即 SKILL.md 所在目录）。

from pathlib import Path
import subprocess
import sys


SLIDES_DIR = Path(__file__).resolve().parent
SKILL_ROOT = Path("/REPLACE_WITH_SKILL_ROOT")   # ← 复制时改为实际路径
SERVER = SKILL_ROOT / "scripts" / "server.py"

try:
    subprocess.run([sys.executable, str(SERVER), str(SLIDES_DIR), *sys.argv[1:]], check=False)
except KeyboardInterrupt:
    pass

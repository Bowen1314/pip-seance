"""Strip machine-specific paths and host names from results/ before publishing.

    python seance/redact.py results

Test output and transcripts quote absolute paths from the machine the seances
ran on (a shared cluster). They carry no information about the
packages, so they are replaced with placeholders. Numbers are untouched.
"""

import os
import re
import sys
from pathlib import Path

HOME = r"/(?:[a-z]+/)?home/[a-z0-9_]+"
RULES = [
    (re.compile(HOME + r"/\.local/share/uv/python/"), "<uv-python>/"),
    (re.compile(HOME + r"/pip-seance/"), "<seance>/"),
    (re.compile(HOME), "<home>"),
    (re.compile(r"/tmp/tmp[a-z0-9_]{6,}"), "/tmp/<tmp>"),
]
# Extra literal strings (user name, host names) come from the environment so
# they don't end up in the repository themselves:
#   SEANCE_REDACT="someuser=user,somehost.example.edu=node"
for pair in filter(None, os.environ.get("SEANCE_REDACT", "").split(",")):
    lit, rep = pair.split("=", 1)
    RULES.append((re.compile(r"\b" + re.escape(lit) + r"\b"), rep))
# host names first (longest literal first)
RULES[4:] = sorted(RULES[4:], key=lambda r: -len(r[0].pattern))

changed = 0
for p in Path(sys.argv[1]).rglob("*"):
    if p.is_file() and p.suffix in (".json", ".jsonl", ".md", ".txt", ".diff", ".log"):
        s = p.read_text()
        t = s
        for rx, rep in RULES:
            t = rx.sub(rep, t)
        if t != s:
            p.write_text(t)
            changed += 1
print(f"redacted {changed} files")

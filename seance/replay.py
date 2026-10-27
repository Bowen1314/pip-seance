"""Re-check every seance without calling a model: apply its revival.diff to a fresh
copy of the pristine sdist, run the original tests on 3.13 and 3.8, and compare
with what run.json recorded.

    python replay.py --runs results/runs --work work --py38 ... --py313 ... [--tag bench]

Costs $0. Prints a table and exits non-zero if any number differs.
"""

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent


def verify(ghosts, project, root, python, pristine):
    out = subprocess.run([sys.executable, str(HERE / "verify.py"), "--ghost", ghosts, "--project", project,
                          "--root", str(root), "--python", python, "--pristine", str(pristine)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", required=True)
    ap.add_argument("--work", required=True)
    ap.add_argument("--ghosts", default=str(HERE.parent / "results" / "ghosts.json"))
    ap.add_argument("--py38", required=True)
    ap.add_argument("--py313", required=True)
    ap.add_argument("--tag", default="")
    a = ap.parse_args()
    bad = 0
    print(f"{'run':48} {'3.13 recorded':>14} {'3.13 replay':>12} {'3.8 recorded':>13} {'3.8 replay':>11}  protected")
    for rd in sorted(Path(a.runs).iterdir()):
        rj = rd / "run.json"
        if not rj.exists() or not rd.name.startswith(a.tag):
            continue
        r = json.load(open(rj))
        proj = r["project"]
        pristine = Path(a.work) / "pristine" / proj
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / proj
            shutil.copytree(pristine, root)
            diff = (rd / "revival.diff").read_text()
            if diff.strip():
                p = subprocess.run(["patch", "-p2", "-s", "-d", str(root)], input=diff, text=True, capture_output=True)
                if p.returncode != 0:
                    print(f"{rd.name}: patch failed: {p.stdout[-300:]} {p.stderr[-300:]}")
                    bad += 1
                    continue
            now = verify(a.ghosts, proj, root, a.py313, pristine)
            then = verify(a.ghosts, proj, root, a.py38, pristine)
        rec13, rec38 = r["verdict"]["py313"]["passing"], r["verdict"]["py38"]["passing"]
        ok = now["targets_passing"] == rec13 and then["targets_passing"] == rec38 and not now["protected_changed"]
        bad += not ok
        print(f"{rd.name:48} {rec13:>6}/{now['targets']:<7} {now['targets_passing']:>6}{'':6} {rec38:>6}/{then['targets']:<6} "
              f"{then['targets_passing']:>6}{'':5}  {','.join(now['protected_changed']) or 'none'}  {'OK' if ok else 'MISMATCH'}")
    print(f"mismatches: {bad}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

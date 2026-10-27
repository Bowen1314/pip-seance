"""Run a ghost's original tests in a workspace and print one JSON line.

    python verify.py --ghost results/ghosts.json --project money --root <workspace> \
        --python envs/py313/bin/python [--brief]

Used two ways:
  * by the agent's run_tests tool (--brief: target tests only, short failure list)
  * by the Temporal verify activity (full result, plus protected-file check)

"Target tests" are the tests that passed on Python 3.8 with the pristine
sdist. A revival is complete when every target test passes on 3.13 and no
protected file (tests, conftest, pytest config) differs from the pristine copy.
"""

import argparse
import json
import sys
from pathlib import Path

from testrun import hash_tests, run_suite

PROTECTED_NAMES = {"conftest.py", "pytest.ini", "tox.ini", "setup.cfg", "pyproject.toml",
                   "sitecustomize.py", "usercustomize.py"}


def protected_hashes(root: Path):
    import hashlib
    h = hash_tests(root)
    for p in root.rglob("*"):
        if p.is_file() and (p.name in PROTECTED_NAMES or p.suffix == ".pth"):
            h[str(p.relative_to(root))] = hashlib.sha256(p.read_bytes()).hexdigest()
    return h


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ghost", required=True)
    ap.add_argument("--project", required=True)
    ap.add_argument("--root", required=True)
    ap.add_argument("--python", required=True)
    ap.add_argument("--pristine")
    ap.add_argument("--timeout", type=int, default=180)
    ap.add_argument("--brief", action="store_true")
    a = ap.parse_args()
    g = next(x for x in json.load(open(a.ghost))["ghosts"] if x["project"] == a.project)
    root = Path(a.root)
    res = run_suite(root, a.python, g["test_files"], a.timeout)
    targets = g["alive_38"]
    passed = set(res["passed"])
    missing = [t for t in targets if t not in passed]
    out = {"targets": len(targets), "targets_passing": len(targets) - len(missing),
           "all_passed": len(res["passed"]), "collected": len(res["outcomes"]),
           "timed_out": res["timed_out"], "first_error": res["first_error"]}
    if a.brief:
        # v2 (after the first bench): each failing target comes with its own error
        # message, so an unrelated collection error elsewhere cannot hide the real one.
        out["failing_targets"] = [{"test": t, "error": res["messages"].get(t, "not collected (see pytest_tail)")}
                                  for t in missing[:8]]
        if missing:
            out["first_error"] = res["messages"].get(missing[0], res["first_error"])
        tail = res["tail"]
        out["pytest_tail"] = tail[-2500:]
    else:
        out["missing_targets"] = missing
        out["outcomes"] = res["outcomes"]
        out["tail"] = res["tail"][-3000:]
        if a.pristine:
            before = protected_hashes(Path(a.pristine))
            after = protected_hashes(root)
            out["protected_changed"] = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
    json.dump(out, sys.stdout)
    print()


if __name__ == "__main__":
    main()

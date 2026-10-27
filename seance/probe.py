"""Step 2: who is a ghost? Run each undead package's own tests on Python 3.8 and 3.13.

A package is a *ghost* when its untouched test suite has at least --min-pass
tests passing on Python 3.8 (it was alive) and some of those same tests fail,
error or never get collected on Python 3.13 (it is dead now).

    python probe.py --undead data/undead.jsonl --out data/probe.jsonl \
        --py38 envs/py38/bin/python --py313 envs/py313/bin/python [--shard 0/4]

Downloads each sdist from PyPI, checks its sha256, unpacks it under
work/pristine/<project>/ (never modified afterwards) and records per-test
outcomes for both interpreters.
"""

import argparse
import hashlib
import json
import shutil
import tarfile
import urllib.request
import zipfile
from pathlib import Path

from testrun import find_test_files, run_suite

NATIVE = (".c", ".cc", ".cpp", ".pyx", ".pxd", ".f", ".f90", ".rs", ".go")


def fetch_and_unpack(rec, work: Path):
    dest = work / "pristine" / rec["project"]
    if (dest / ".seance-ok").exists():
        return dest
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    data = urllib.request.urlopen(urllib.request.Request(rec["sdist_url"], headers={"User-Agent": "pip-seance/0.1"}), timeout=60).read()
    if hashlib.sha256(data).hexdigest() != rec["sdist_sha256"]:
        raise RuntimeError("sha256 mismatch")
    arc = work / "dl" / Path(rec["sdist_url"]).name
    arc.parent.mkdir(parents=True, exist_ok=True)
    arc.write_bytes(data)
    tmp = dest.parent / (rec["project"] + ".unpack")
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir()
    if arc.name.endswith(".zip"):
        with zipfile.ZipFile(arc) as z:
            for m in z.namelist():
                if m.startswith("/") or ".." in Path(m).parts:
                    raise RuntimeError("unsafe zip member")
            z.extractall(tmp)
    else:
        with tarfile.open(arc) as t:
            t.extractall(tmp, filter="data")
    kids = list(tmp.iterdir())
    src = kids[0] if len(kids) == 1 and kids[0].is_dir() else tmp
    shutil.rmtree(dest)
    shutil.move(str(src), str(dest))
    shutil.rmtree(tmp, ignore_errors=True)
    (dest / ".seance-ok").write_text(rec["sdist_sha256"])
    return dest


def probe(rec, work, py38, py313, min_pass, timeout):
    r = {"project": rec["project"], "version": rec["version"], "last_upload": rec["last_upload"],
         "downloads_30d": rec["downloads_30d"]}
    if not rec.get("sdist_url"):
        return {**r, "status": "no_sdist"}
    try:
        root = fetch_and_unpack(rec, work)
    except Exception as e:
        return {**r, "status": "fetch_failed", "why": str(e)[:200]}
    native = [str(p.relative_to(root)) for p in root.rglob("*") if p.suffix in NATIVE]
    if native:
        return {**r, "status": "native_code", "why": native[:3]}
    tests = find_test_files(root)
    if not tests:
        return {**r, "status": "no_tests"}
    r["test_files"] = tests
    old = run_suite(root, py38, tests, timeout)
    r["py38"] = {"passed": len(old["passed"]), "total": len(old["outcomes"]), "timed_out": old["timed_out"],
                 "first_error": old["first_error"]}
    if len(old["passed"]) < min_pass:
        return {**r, "status": "not_alive_on_38"}
    new = run_suite(root, py313, tests, timeout)
    lost = sorted(set(old["passed"]) - set(new["passed"]))
    r["py313"] = {"passed": len(new["passed"]), "total": len(new["outcomes"]), "timed_out": new["timed_out"],
                  "first_error": new["first_error"], "tail": new["tail"][-1500:]}
    r["alive_38"] = old["passed"]
    r["lost_on_313"] = lost
    r["status"] = "ghost" if lost else "still_alive"
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--undead", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--work", default="work")
    ap.add_argument("--py38", required=True)
    ap.add_argument("--py313", required=True)
    ap.add_argument("--min-pass", type=int, default=3)
    ap.add_argument("--timeout", type=int, default=180)
    ap.add_argument("--shard", default="0/1")
    a = ap.parse_args()
    k, n = map(int, a.shard.split("/"))
    recs = [json.loads(l) for l in open(a.undead) if not l.startswith('{"_meta"')]
    recs = [x for i, x in enumerate(recs) if i % n == k]
    done = set()
    if Path(a.out).exists():
        done = {json.loads(l)["project"] for l in open(a.out)}
    work = Path(a.work).resolve()
    with open(a.out, "a") as f:
        for rec in recs:
            if rec["project"] in done:
                continue
            res = probe(rec, work, a.py38, a.py313, a.min_pass, a.timeout)
            f.write(json.dumps(res) + "\n")
            f.flush()
            print(f"{res['status']:16} {rec['project']}", flush=True)


if __name__ == "__main__":
    main()

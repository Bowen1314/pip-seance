"""Step 3: merge probe shards into results/ghosts.json (the guest list for the seance)
and results/census.json (what happened to every undead package).

    python ghosts.py --probe 'data/probe*.jsonl' --undead data/undead.jsonl --out results/
"""

import argparse
import collections
import glob
import json
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", required=True)
    ap.add_argument("--undead", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    meta = json.loads(open(a.undead).readline())["_meta"]
    rows = [json.loads(l) for f in sorted(glob.glob(a.probe)) for l in open(f)]
    rows.sort(key=lambda r: -r["downloads_30d"])
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    ghosts = [{k: r[k] for k in ("project", "version", "last_upload", "downloads_30d", "test_files",
                                  "alive_38", "lost_on_313")} | {"py38": r["py38"], "py313": {k: v for k, v in r["py313"].items() if k != "tail"},
                                                                   "py313_tail": r["py313"].get("tail", "")}
              for r in rows if r["status"] == "ghost"]
    census = {"source": meta, "undead": len(rows), "status": collections.Counter(r["status"] for r in rows),
              "packages": [{k: r.get(k) for k in ("project", "version", "last_upload", "downloads_30d", "status")}
                           | {"py38_passed": (r.get("py38") or {}).get("passed"), "py313_passed": (r.get("py313") or {}).get("passed")}
                           for r in rows]}
    json.dump({"ghosts": ghosts}, open(out / "ghosts.json", "w"), indent=1)
    json.dump(census, open(out / "census.json", "w"), indent=1)
    print(f"{len(rows)} probed: {dict(census['status'])}; {len(ghosts)} ghosts")
    for g in ghosts:
        print(f"  {g['project']:28} last {g['last_upload'][:10]}  {g['downloads_30d']:>10,}/30d  "
              f"3.8 {g['py38']['passed']:>4}  3.13 {g['py313']['passed']:>4}  {g['py313']['first_error']}")


if __name__ == "__main__":
    main()

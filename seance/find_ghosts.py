"""Step 1: find abandoned-but-still-downloaded packages ("the undead").

Reads the 15,000 most-downloaded PyPI projects of the last 30 days
(hugovk/top-pypi-packages, a public dataset built from PyPI's BigQuery logs),
asks the PyPI JSON API when each one last uploaded a file, and keeps the ones
whose newest upload is older than the cutoff and that ship an sdist (we need
the source tree, tests included).

    python find_ghosts.py --out data/undead.jsonl [--cutoff 2018-01-01]

Network-bound only (16 threads of HTTP GETs). No API key, no account.
"""

import argparse
import concurrent.futures as cf
import json
import time
import urllib.request

TOP_URL = "https://hugovk.dev/top-pypi-packages/top-pypi-packages.min.json"
UA = {"User-Agent": "pip-seance/0.1 (+https://github.com/Bowen1314/pip-seance)"}


def get_json(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(2 * (i + 1))
        except Exception:
            time.sleep(2 * (i + 1))
    return None


def inspect(row, cutoff):
    name = row["project"]
    d = get_json(f"https://pypi.org/pypi/{name}/json")
    if not d:
        return None
    uploads = [f["upload_time_iso_8601"] for files in d.get("releases", {}).values() for f in files]
    if not uploads:
        return None
    last = max(uploads)
    if last >= cutoff:
        return None
    latest = d["info"]["version"]
    files = d.get("releases", {}).get(latest, []) or d.get("urls", [])
    sdist = [f for f in files if f.get("packagetype") == "sdist"]
    return {
        "project": name,
        "downloads_30d": row["download_count"],
        "version": latest,
        "last_upload": last,
        "requires_dist": d["info"].get("requires_dist"),
        "classifiers": [c for c in d["info"].get("classifiers") or [] if c.startswith("Programming Language :: Python")],
        "sdist_url": sdist[0]["url"] if sdist else None,
        "sdist_sha256": sdist[0]["digests"]["sha256"] if sdist else None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--cutoff", default="2018-01-01")
    ap.add_argument("--threads", type=int, default=16)
    a = ap.parse_args()
    top = get_json(TOP_URL)
    rows = top["rows"]
    print(f"top list: {len(rows)} projects, dataset updated {top['last_update']}", flush=True)
    found = []
    with cf.ThreadPoolExecutor(a.threads) as ex:
        for i, r in enumerate(ex.map(lambda row: inspect(row, a.cutoff), rows)):
            if r:
                found.append(r)
            if i % 1000 == 999:
                print(f"  {i + 1} checked, {len(found)} undead so far", flush=True)
    found.sort(key=lambda r: -r["downloads_30d"])
    with open(a.out, "w") as f:
        f.write(json.dumps({"_meta": {"source": TOP_URL, "dataset_updated": top["last_update"],
                                      "checked": len(rows), "cutoff": a.cutoff}}) + "\n")
        for r in found:
            f.write(json.dumps(r) + "\n")
    print(f"done: {len(found)} of {len(rows)} last uploaded before {a.cutoff}; "
          f"{sum(1 for r in found if r['sdist_url'])} with an sdist", flush=True)


if __name__ == "__main__":
    main()

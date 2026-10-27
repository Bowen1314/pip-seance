"""Make a Temporal history export readable: base64 payloads -> JSON, in place.

    python seance/decode_history.py results/runs/<run>/history.json
"""

import base64
import json
import sys

path = sys.argv[1]
h = json.load(open(path))
n = 0


def walk(o):
    global n
    if isinstance(o, dict):
        if isinstance(o.get("data"), str) and "metadata" in o:
            try:
                o["data"] = json.loads(base64.b64decode(o["data"]).decode())
                o["_decoded"] = "payload data base64-decoded for readability by seance tooling"
                n += 1
            except Exception:
                pass
        for v in o.values():
            walk(v)
    elif isinstance(o, list):
        for v in o:
            walk(v)


walk(h)
open(path, "w").write(json.dumps(h, indent=1))
print(f"decoded {n} payloads")

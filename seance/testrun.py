"""Run a package's own test files under a given interpreter and read the result.

Shared by probe.py (who is dead?) and verify.py (did the revival work?).
The test files are passed explicitly, the package source root is on
PYTHONPATH, nothing is pip-installed, and the unittest-alias shim is loaded.
"""

import hashlib
import os
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
SHIM_DIR = HERE / "shim"
TEST_NAME = re.compile(r"(^test.*\.py$|.*_test\.py$|^tests\.py$)")
SKIP_DIRS = {".git", ".tox", "build", "dist", ".eggs", "__pycache__", "venv", ".venv", "docs", "doc"}


def find_test_files(root: Path):
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not d.endswith(".egg-info"))
        rel = Path(dirpath).relative_to(root)
        in_test_dir = any(p in ("test", "tests", "testing") for p in rel.parts)
        for fn in sorted(filenames):
            if not fn.endswith(".py") or fn in ("setup.py", "conftest.py", "__init__.py"):
                continue
            if TEST_NAME.match(fn) or (in_test_dir and fn.startswith("test")):
                out.append(str(rel / fn))
    return out


def is_test_path(rel: str) -> bool:
    parts = Path(rel).parts
    return (any(p in ("test", "tests", "testing") for p in parts[:-1])
            or bool(TEST_NAME.match(parts[-1])) or parts[-1] == "conftest.py")


def hash_tests(root: Path):
    """sha256 of every test-ish file (test files, conftest.py, anything under tests/)."""
    h = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in (".git", "__pycache__", ".pytest_cache"))
        for fn in sorted(filenames):
            rel = str((Path(dirpath) / fn).relative_to(root))
            if is_test_path(rel) and not fn.endswith((".pyc",)):
                h[rel] = hashlib.sha256((Path(dirpath) / fn).read_bytes()).hexdigest()
    return h


def _pythonpath(root: Path):
    parts = [str(SHIM_DIR), str(root)]
    for sub in ("src", "lib"):
        if (root / sub).is_dir():
            parts.append(str(root / sub))
    return os.pathsep.join(parts)


def run_suite(root: Path, python: str, test_files, timeout=180):
    root = Path(root)
    with tempfile.TemporaryDirectory() as td:
        xml = Path(td) / "junit.xml"
        env = {k: v for k, v in os.environ.items() if not k.startswith(("PYTHON", "VIRTUAL_ENV", "NEBIUS", "OPENAI", "LLM_"))}
        env.update({"PYTHONPATH": _pythonpath(root), "PYTHONDONTWRITEBYTECODE": "1",
                    "PYTHONHASHSEED": "0", "OMP_NUM_THREADS": "1", "PYTEST_ADDOPTS": ""})
        cmd = [python, "-m", "pytest", "-q", "-p", "no:cacheprovider", "-p", "seance_shim",
               "--rootdir", str(root), f"--junitxml={xml}", "-o", "junit_family=xunit2",
               "--continue-on-collection-errors", *test_files]
        try:
            p = subprocess.run(cmd, cwd=root, env=env, capture_output=True, text=True, timeout=timeout)
            out, rc, timed_out = p.stdout + p.stderr, p.returncode, False
        except subprocess.TimeoutExpired as e:
            out = (e.stdout or b"").decode(errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
            rc, timed_out = None, True
        outcomes, messages = {}, {}
        if xml.exists():
            try:
                for tc in ET.parse(xml).getroot().iter("testcase"):
                    tid = f"{tc.get('classname', '')}::{tc.get('name', '')}"
                    kind = "passed"
                    for child in tc:
                        if child.tag in ("failure", "error"):
                            kind = "failed" if child.tag == "failure" else "error"
                            msg = child.get("message") or ""
                            if not msg:
                                lines = (child.text or "").strip().splitlines()
                                msg = lines[-1] if lines else ""
                            messages[tid] = msg[:300]
                        elif child.tag == "skipped":
                            kind = "skipped"
                    outcomes[tid] = kind
            except ET.ParseError:
                pass
    return {
        "rc": rc,
        "timed_out": timed_out,
        "outcomes": outcomes,
        "passed": sorted(t for t, k in outcomes.items() if k == "passed"),
        "messages": messages,
        "tail": out[-4000:],
        "first_error": first_error(out),
    }


_ERR = re.compile(r"^E\s+((?:[A-Za-z_][\w.]*)(?:Error|Exception|Warning)\b.*)$", re.M)
_ERR2 = re.compile(r"^((?:ModuleNotFoundError|ImportError|AttributeError|SyntaxError|NameError|TypeError)\b.*)$", re.M)


def first_error(text: str):
    m = _ERR.search(text) or _ERR2.search(text)
    return m.group(1).strip()[:200] if m else None

#!/usr/bin/env bash
# Two interpreters: "then" (CPython 3.8, 2019) and "now" (CPython 3.13).
# Same test tooling in both: pytest 8.3.5 (supports 3.8-3.13), mock, six.
set -euo pipefail
cd "$(dirname "$0")/.."
UV=${UV:-uv}
$UV python install 3.8 3.13
for v in 3.8 3.13; do
  d=envs/py${v/./}
  [ -x $d/bin/python ] || $UV venv -q -p $v $d
  $UV pip install -q --python $d/bin/python pytest==8.3.5 mock==5.2.0 six==1.17.0
  $d/bin/python -c "import sys, pytest; print(sys.version.split()[0], 'pytest', pytest.__version__)"
done

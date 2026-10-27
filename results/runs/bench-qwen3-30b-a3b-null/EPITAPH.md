# null 0.6.1: REVIVED

| | |
|---|---|
| last upload | 2013-03-05 |
| downloads, last 30 days | 78,899 |
| medium (model) | Qwen/Qwen3-30B-A3B-Instruct-2507 |
| target tests (passed on 3.8, pristine) | 6 |
| passing on 3.13 before | 0 |
| passing on 3.13 after | 6 |
| passing on 3.8 after (did we break the past?) | 6/6 |
| protected files changed | none |
| files / lines changed | 1 / 2 |
| model steps, tokens in/out | 6, 12,692 / 232 |
| cost | $0.0013 |
| activity attempts | 1 |
| stopped because | finished |

## Cause of death on Python 3.13

```
ImportError: cannot import name 'MutableMapping' from 'collections' (<uv-python>/cpython-3.13.18-linux-x86_64-gnu/lib/python3.13/collections/__init__.py)
```

## The medium's last words

```
CAUSE OF DEATH: `collections.MutableMapping` and `collections.MutableSequence` were removed from the `collections` module in Python 3.10+ and moved to `collections.abc`.
REMEDY: Changed `from collections import MutableMapping, MutableSequence` to `from collections.abc import MutableMapping, MutableSequence` in `src/null.py`.
```

Diff: [revival.diff](revival.diff) · transcript: [transcript.jsonl](transcript.jsonl)

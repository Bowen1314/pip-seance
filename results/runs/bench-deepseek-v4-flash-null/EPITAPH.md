# null 0.6.1: REVIVED

| | |
|---|---|
| last upload | 2013-03-05 |
| downloads, last 30 days | 78,899 |
| medium (model) | deepseek-ai/DeepSeek-V4-Flash-0731 |
| target tests (passed on 3.8, pristine) | 6 |
| passing on 3.13 before | 0 |
| passing on 3.13 after | 6 |
| passing on 3.8 after (did we break the past?) | 6/6 |
| protected files changed | none |
| files / lines changed | 1 / 5 |
| model steps, tokens in/out | 4, 10,880 / 266 |
| cost | $0.0016 |
| activity attempts | 1 |
| stopped because | finished |

## Cause of death on Python 3.13

```
ImportError: cannot import name 'MutableMapping' from 'collections' (<uv-python>/cpython-3.13.18-linux-x86_64-gnu/lib/python3.13/collections/__init__.py)
```

## The medium's last words

```
CAUSE OF DEATH: `MutableMapping`/`MutableSequence` were removed from `collections` and moved to `collections.abc` in Python 3.3+.

REMEDY: Imported them from `collections.abc` with a fallback to `collections` for older Python versions.
```

Diff: [revival.diff](revival.diff) · transcript: [transcript.jsonl](transcript.jsonl)

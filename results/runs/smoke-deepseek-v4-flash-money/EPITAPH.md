# money 1.3.0: REVIVED

| | |
|---|---|
| last upload | 2016-04-17 |
| downloads, last 30 days | 56,238 |
| medium (model) | deepseek-ai/DeepSeek-V4-Flash-0731 |
| target tests (passed on 3.8, pristine) | 20 |
| passing on 3.13 before | 0 |
| passing on 3.13 after | 20 |
| passing on 3.8 after (did we break the past?) | 20/20 |
| protected files changed | none |
| files / lines changed | 2 / 28 |
| model steps, tokens in/out | 12, 177,678 / 5,062 |
| cost | $0.0263 |
| activity attempts | 1 |
| stopped because | finished |

## Cause of death on Python 3.13

```
ModuleNotFoundError: No module named 'distutils'
```

## The medium's last words

```
All 20 target tests pass on Python 3.13.

CAUSE OF DEATH: Python 3.12+ removed the `distutils` module, so `from distutils.version import StrictVersion` raised `ModuleNotFoundError` at import time, preventing the whole package (and its tests) from being collected.

REMEDY: Replaced the unconditional `distutils.version.StrictVersion` import in both `src/money/money.py` and `src-py2/money/money.py` with a try/except that falls back to `packaging.version.Version` and, if that is unavailable, to a minimal `StrictVersion` compatibility class. This keeps Python 3.8 working while fixing 3.13.
```

Diff: [revival.diff](revival.diff) · transcript: [transcript.jsonl](transcript.jsonl)

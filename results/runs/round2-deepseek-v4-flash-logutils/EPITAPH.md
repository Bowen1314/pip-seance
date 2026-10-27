# logutils 0.3.5: REVIVED

| | |
|---|---|
| last upload | 2017-06-24 |
| downloads, last 30 days | 104,273 |
| medium (model) | deepseek-ai/DeepSeek-V4-Flash-0731 |
| target tests (passed on 3.8, pristine) | 31 |
| passing on 3.13 before | 16 |
| passing on 3.13 after | 31 |
| passing on 3.8 after (did we break the past?) | 31/31 |
| protected files changed | none |
| files / lines changed | 1 / 9 |
| model steps, tokens in/out | 10, 106,497 / 2,676 |
| cost | $0.0157 |
| activity attempts | 1 |
| stopped because | finished |

## Cause of death on Python 3.13

```
ModuleNotFoundError: No module named 'redis'
```

## The medium's last words

```
I'll start by exploring the package structure and running the tests.Let me look at the relevant library files.Let me search for `_acquireLock` and look at the rest of dictconfig.py.Now let me look at `logutils/__init__.py` and `testing.py` for the `hasHandlers` issue.Now I understand the main issue. Let me fix the `_acquireLock`/`_releaseLock` removal in Python 3.13 by adding compatibility functions to the logging module.All 31 target tests now pass. The remaining `redis` error is from `test_redis.py`, which is not a target test (it requires the non-installed `redis` package and was already an error, not a failing target).

CAUSE OF DEATH: Python 3.13 removed the private `logging._acquireLock()` / `logging._releaseLock()` functions (replaced by the `logging._lock` RLock), which `logutils/dictconfig.py` and the tests relied on.

REMEDY: In `logutils/dictconfig.py`, added compatibility shims that install `logging._acquireLock`/`_releaseLock` (backed by `logging._lock`) only when they are missing, so the code works on both Python 3.8 and 3.13.
```

Diff: [revival.diff](revival.diff) · transcript: [transcript.jsonl](transcript.jsonl)

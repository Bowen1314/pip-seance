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
| files / lines changed | 2 / 10 |
| model steps, tokens in/out | 8, 41,592 / 1,145 |
| cost | $0.0061 |
| activity attempts | 2 |
| stopped because | finished |

> Note added after the run: this run had 2 attempts (worker A was SIGKILLed after step 4). The cost,
> steps and token rows above count attempt 2 only. The ledger total for the run, both attempts, is
> **$0.0084** (12 model calls); see `ledger/spend.jsonl`, rows with `"run":"chaos-deepseek-v4-flash-money"`.
> Later versions of `epitaph()` print both numbers.

## Cause of death on Python 3.13

```
ModuleNotFoundError: No module named 'distutils'
```

## The medium's last words

```
All 20 target tests pass on Python 3.13.

CAUSE OF DEATH: Python 3.13 removed the `distutils` module, so `from distutils.version import StrictVersion` raised `ModuleNotFoundError` at import time, breaking collection of every test module.

REMEDY: In both `src/money/money.py` and `src-py2/money/money.py`, wrapped the `distutils.version.StrictVersion` import in a try/except that falls back to `packaging.version.Version` when `distutils` is unavailable (keeping Python 3.8 compatibility).
```

Diff: [revival.diff](revival.diff) · transcript: [transcript.jsonl](transcript.jsonl)

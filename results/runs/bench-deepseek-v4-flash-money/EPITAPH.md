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
| files / lines changed | 1 / 38 |
| model steps, tokens in/out | 10, 98,937 / 4,442 |
| cost | $0.0151 |
| activity attempts | 1 |
| stopped because | finished |

## Cause of death on Python 3.13

```
ModuleNotFoundError: No module named 'distutils'
```

## The medium's last words

```
I'll start by exploring the package structure and running the tests.Let me look at the source files.Now I understand the issue. The `distutils` module was removed in Python 3.12+. Let me fix the `StrictVersion` import in `src/money/money.py`.All 20 target tests pass. Let me verify the mixins.py babel import situation to ensure the src tests are truly fine.All 20 target tests pass on Python 3.13. The remaining collection errors are from `src-py2/` (Python 2-only code, not part of the target tests) and an import-file-mismatch between the two source trees.

The fix was straightforward: Python 3.12+ removed the `distutils` module, which `money.py` imported for `StrictVersion`.

CAUSE OF DEATH: Python 3.12 removed the `distutils` module; `from distutils.version import StrictVersion` raised `ModuleNotFoundError`, preventing the whole package from importing.

REMEDY: Replaced the hard `distutils` import in `src/money/money.py` with a try/except chain that falls back to `packaging.version.Version` and finally to a minimal built-in `StrictVersion` class, so the module imports on both Python 3.8 and 3.13.
```

Diff: [revival.diff](revival.diff) · transcript: [transcript.jsonl](transcript.jsonl)

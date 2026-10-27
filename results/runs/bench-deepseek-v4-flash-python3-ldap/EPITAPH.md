# python3-ldap 0.9.8.4: REVIVED

| | |
|---|---|
| last upload | 2015-05-28 |
| downloads, last 30 days | 82,404 |
| medium (model) | deepseek-ai/DeepSeek-V4-Flash-0731 |
| target tests (passed on 3.8, pristine) | 36 |
| passing on 3.13 before | 15 |
| passing on 3.13 after | 36 |
| passing on 3.8 after (did we break the past?) | 36/36 |
| protected files changed | none |
| files / lines changed | 1 / 9 |
| model steps, tokens in/out | 7, 34,246 / 1,520 |
| cost | $0.0052 |
| activity attempts | 1 |
| stopped because | finished |

## Cause of death on Python 3.13

```
AttributeError: module 'collections' has no attribute 'MutableMapping'
```

## The medium's last words

```
All 36 target tests pass. Let me check the remaining SyntaxError in connection.py to make sure it's not a real issue in the library.All 36 target tests pass. The remaining errors are from tests that were not part of the target set (they didn't pass on Python 3.8 either — e.g. `testTls.py` fails because `strategy/async.py` uses the reserved keyword `async` as a module name, which is a pre-existing issue unrelated to the 3.8→3.13 regression we were asked to fix).

The fix was the single `collections` regression.

CAUSE OF DEATH: Python 3.10 moved `MutableMapping`/`Mapping` from the `collections` module to `collections.abc`, so `collections.MutableMapping` raised `AttributeError` at import time, breaking nearly every test module.

REMEDY: In `ldap3/utils/ciDict.py`, import `MutableMapping` and `Mapping` from `collections.abc` with a fallback to `collections` for older Pythons, and use those names for the class base and the `isinstance` check.
```

Diff: [revival.diff](revival.diff) · transcript: [transcript.jsonl](transcript.jsonl)

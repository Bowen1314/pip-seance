# pyxb 1.2.6: STIRRED

| | |
|---|---|
| last upload | 2017-09-03 |
| downloads, last 30 days | 110,732 |
| medium (model) | deepseek-ai/DeepSeek-V4-Flash-0731 |
| target tests (passed on 3.8, pristine) | 736 |
| passing on 3.13 before | 10 |
| passing on 3.13 after | 153 |
| passing on 3.8 after (did we break the past?) | 736/736 |
| protected files changed | none |
| files / lines changed | 2 / 20 |
| model steps, tokens in/out | 20, 297,302 / 3,232 |
| cost | $0.0425 |
| activity attempts | 1 |
| stopped because | cost_cap |

## Cause of death on Python 3.13

```
ModuleNotFoundError: No module named 'pyxb.utils.six.moves'
```

## The medium's last words

```
The vendored six uses the old PEP 302 `find_module`/`load_module` API, which Python 3.12+ no longer calls (it requires PEP 451 `find_spec`). Let me add the modern methods.
```

Diff: [revival.diff](revival.diff) · transcript: [transcript.jsonl](transcript.jsonl)

# cookies 2.2.1: STILL DEAD

| | |
|---|---|
| last upload | 2014-09-27 |
| downloads, last 30 days | 182,317 |
| medium (model) | deepseek-ai/DeepSeek-V4-Flash-0731 |
| target tests (passed on 3.8, pristine) | 66 |
| passing on 3.13 before | 0 |
| passing on 3.13 after | 0 |
| passing on 3.8 after (did we break the past?) | 0/66 |
| protected files changed | none |
| files / lines changed | 1 / 4 |
| model steps, tokens in/out | 19, 296,672 / 5,114 |
| cost | $0.0430 |
| activity attempts | 1 |
| stopped because | cost_cap |

## Cause of death on Python 3.13

```
re.PatternError: global flags not at the start of the expression at position 399 (line 7, column 33)
```

## The medium's last words

```
The issue is nested inline regex flags. `DATE` has `(?ix)` at its start and is embedded into `EXPIRES_AV` and `ATTR`, putting global flags in the middle of those patterns. Let me fix `DATE` to use scoped flags.Now add the closing `)` for the scoped flag group:
```

Diff: [revival.diff](revival.diff) · transcript: [transcript.jsonl](transcript.jsonl)

# kafka 1.3.5: STILL DEAD

| | |
|---|---|
| last upload | 2017-10-07 |
| downloads, last 30 days | 239,184 |
| medium (model) | Qwen/Qwen3-30B-A3B-Instruct-2507 |
| target tests (passed on 3.8, pristine) | 41 |
| passing on 3.13 before | 0 |
| passing on 3.13 after | 0 |
| passing on 3.8 after (did we break the past?) | 41/41 |
| protected files changed | none |
| files / lines changed | 1 / 39 |
| model steps, tokens in/out | 40, 969,795 / 2,080 |
| cost | $0.0976 |
| activity attempts | 1 |
| stopped because | cost_cap |

## Cause of death on Python 3.13

```
ModuleNotFoundError: No module named 'kafka.vendor.six.moves'
```

## The medium's last words

```
(none)
```

Diff: [revival.diff](revival.diff) · transcript: [transcript.jsonl](transcript.jsonl)

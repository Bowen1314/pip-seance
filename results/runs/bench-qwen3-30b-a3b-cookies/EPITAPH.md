# cookies 2.2.1: STILL DEAD

| | |
|---|---|
| last upload | 2014-09-27 |
| downloads, last 30 days | 182,317 |
| medium (model) | Qwen/Qwen3-30B-A3B-Instruct-2507 |
| target tests (passed on 3.8, pristine) | 66 |
| passing on 3.13 before | 0 |
| passing on 3.13 after | 0 |
| passing on 3.8 after (did we break the past?) | 66/66 |
| protected files changed | none |
| files / lines changed | 0 / 0 |
| model steps, tokens in/out | 29, 304,965 / 1,153 |
| cost | $0.0308 |
| activity attempts | 1 |
| stopped because | finished |

## Cause of death on Python 3.13

```
re.PatternError: global flags not at the start of the expression at position 399 (line 7, column 33)
```

## The medium's last words

```
The issue is that Python 3.13 has stricter handling of backslashes in raw strings and regex patterns. The error `re.PatternError: global flags not at the start of the expression at position 399 (line 7, column 33)` indicates that the regex pattern is being interpreted incorrectly due to invalid escape sequences.

The root cause is that the library uses raw strings with backslashes (like `\Z`, `\d`, `\.`) but does not properly escape them in string literals. In Python 3.13, these invalid escape sequences are now flagged as errors.

The fix is to use raw strings (`r""`) consistently for regex patterns to avoid backslash interpretation issues.

For example:
- `DOMAIN = "\.?(?:{label}\.)*(?:{label})".format(label=LABEL)` should be `DOMAIN = r"\.?(?:{label}\.)*(?:{label})".format(label=LABEL)`
- Similarly, `DAY_OF_MONTH = "(?:[0 ]?[1-9]|[12][0-9]|[3][01])(?!\d)"` should be `DAY_OF_MONTH = r"(?:[0 ]?[1-9]|[12][0-9]|[3][01])(?!\d)"`

All regex patterns using backslashes need to be prefixed with `r` to ensure they are treated as raw strings.

CAUSE OF DEATH: Python 3.13 now raises `re.PatternError` for invalid escape sequences in regex patterns, which were previously silently ignored.
REMEDY: Prefix all regex string literals with `r` to make them raw strings, preventing backslash interpretation issues.
```

Diff: [revival.diff](revival.diff) · transcript: [transcript.jsonl](transcript.jsonl)

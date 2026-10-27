---
title: I held a seance for ten dead PyPI packages
published: false
description: 427 packages in PyPI's top 15,000 haven't uploaded anything since before 2018. Ten of them pass their own tests on Python 3.8 and fail them on 3.13. An open-weight model raised six of them, for 83 cents all told.
tags: devchallenge, hf26challenge, python, opensource
cover_image: https://raw.githubusercontent.com/Bowen1314/pip-seance/main/docs/assets/cover.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 4: Ghost in the Machine](https://dev.to/challenges/hacktoberfest-week4-2026-10-26)*

## What I Built

`zipfile36` hasn't had a release since October 2016. Last month it was downloaded **1,178,018 times**.

It isn't alone. I took the 15,000 most-downloaded projects on PyPI and asked PyPI when each of them
last uploaded a file. **427** haven't uploaded anything since before 2018, and people still
install them every day. Nobody is maintaining them, and Python keeps moving: `distutils` is gone, `collections.MutableMapping` is gone, `imp` is gone,
`nntplib` is gone.

So I went looking for the ones that died of it. A package counts as a **ghost** if its own test
suite, as shipped in its last sdist, passes on Python 3.8 and fails on Python 3.13. Of the 427, 45
still passed their own tests on 3.8 (at least three tests each). On 3.13, 35 of those still pass.
**Ten don't.**

**pip-seance** holds a seance for each ghost. A medium, which is a [Mastra](https://mastra.ai)
agent running an open-weight model, gets a copy of the package and six small tools. It may read
anything and edit the library code. It may not touch the tests, which act as the judge. The
whole seance runs as a [Temporal](https://temporal.io) workflow, so if the machine dies mid-seance,
it continues somewhere else. At the end, the original tests run on Python 3.13 *and* on 3.8
(raising the dead shouldn't kill the living), and the package gets an epitaph.

Six of the ten rose. DeepSeek V4 Flash raised five in its first pass, for 27 cents across all ten
attempts, and
a sixth after I fixed a mistake in my own tooling. But the more interesting results are the ones
in between: a revival that wasn't one, a medium that found the cure and couldn't apply it, and a
kill switch that didn't kill.

It's Día de los Muertos this weekend, the time for remembering the dead and the work they left.
This felt like the right way to mark it as a programmer: these packages were written by people a
decade ago, and a million installs a month still lean on that work.

## Demo

**The graveyard: [bowen1314.github.io/pip-seance](https://bowen1314.github.io/pip-seance/)**

![The graveyard page: a headstone per ghost with last upload date, monthly downloads, cause of death, and one badge per seance. Gold headstones were raised.](https://raw.githubusercontent.com/Bowen1314/pip-seance/main/docs/assets/graveyard.png)

One headstone per ghost, generated from the results. Each badge is one seance and links to its
epitaph: before and after test counts, whether Python 3.8 still passes, the diff, the cost, and
the medium's last words. Here is
[kafka's](https://github.com/Bowen1314/pip-seance/blob/main/results/runs/bench-deepseek-v4-flash-kafka/EPITAPH.md).

![Bar chart: target tests passing on Python 3.13 for each of the ten packages, before and after each model's seance.](https://raw.githubusercontent.com/Bowen1314/pip-seance/main/docs/assets/raised.png)

## Code

{% github Bowen1314/pip-seance %}

Everything behind this post is in the repo: the census, every seance's transcript, diff and
epitaph, my review of each revival, the Temporal history of the chaos test, and a ledger with
every model call priced. `seance/replay.py` re-applies every recorded diff to a fresh copy of the
package and re-runs the judge, so you can check every number here without calling a model.

## How I Built It

**Finding the dead.** The 15,000 most-downloaded projects come from
[hugovk/top-pypi-packages](https://github.com/hugovk/top-pypi-packages), which is built from
PyPI's public download data. For each project, PyPI's JSON API gives the newest upload time across
all releases. Anything before 2018 is "undead": 427 packages. For each of those,
`seance/probe.py` downloads the latest sdist, checks its sha256, and runs the test files it
contains, unchanged, on CPython 3.8 and 3.13, with the same pytest 8.3.5 and nothing else besides
mock and six.

Most of the 427 dropped out for dull reasons. In 245 I found no test files in the sdist, 109
couldn't pass three of their own tests on 3.8 (77 of those stopped at an import error, usually a
test dependency like nose or Django that I hadn't installed), 16 have C code, and 12 have no sdist
at all. That left 45 that
were provably alive on 3.8, and 10 of them that are dead on 3.13. The tests that passed on 3.8 are
the **target tests**. A seance succeeds when every target test passes on 3.13.

One judgment call: Python 3.12 also deleted old unittest spellings like `assertEquals`. That breaks
the *test file*, not the library. Since nobody may edit tests, a small pytest plugin puts those
aliases back in every run, before and after, old Python and new. It can't make a broken library
pass, it just stops a test's spelling from counting as a death.

**The medium: Mastra over open weights.** Mastra already knows Nebius Token Factory as a
provider, so the model is a string and the key comes from `NEBIUS_API_KEY`:

```ts
const agent = new Agent({
  id: 'medium',
  name: 'medium',
  instructions: INSTRUCTIONS,            // ~20 lines: fix the cause, never the tests, keep 3.8 working
  model: `nebius/${modelId}`,            // e.g. nebius/deepseek-ai/DeepSeek-V4-Flash-0731
  tools,                                 // list_files, read_file, search, edit_file, write_file, run_tests
});
```

The six tools are built with `createTool` and jailed to the package directory. `edit_file` and
`write_file` refuse anything under `test/` or `tests/`, any test file, `conftest.py`, and the
pytest/tox/setup config files. The verify step also hashes all of those against the pristine
copy afterwards. `run_tests` runs the original suite on 3.13 and tells the agent how many target
tests pass, which ones still fail, and the end of pytest's output. There's no shell. The medium
can't install anything, and it can't read my environment.

Every model step lands in `onStepFinish`, where its token usage is priced from Nebius's live
`/v1/models` prices and appended to a ledger file before the next step starts. A run is capped at
4 cents and the whole project at $1.00.

**The ritual: Temporal.** Each seance is a workflow with four activities:

```ts
export async function seanceWorkflow(a: { project: string; model: string; run: string }) {
  const prep = await quick.prepare({ project: a.project, run: a.run });        // copy the pristine sdist
  const result = await medium.seance({ ...a, root: prep.root, brief: prep.brief }); // the agent loop
  const verdict = await quick.verify({ ...a, root: prep.root, pristine: prep.pristine });
  const attempts = await quick.countAttempts({ run: a.run });
  return await quick.epitaph({ ...a, seance: result, verdict, attempts });
}
```

The agent loop is one activity with a 90-second heartbeat timeout and three attempts. Workflow
ids are deterministic (`bench-<model>-<package>`), so if the client crashes, re-running it attaches
to the seances already in flight instead of paying for them twice. The dev server keeps its state
in a SQLite file, and everything ran as Slurm jobs on a university cluster, because a seance
executes a decade-old stranger's code and I wanted that off my laptop.

**Then I killed it.** `scripts/chaos_job.sh` starts a worker and a seance for `money`, waits until
the medium has made four model calls, and sends the worker `SIGKILL`. No cleanup, no warning. Ten
seconds later it starts a second worker. Here's what happened:

```
15:17:04  attempt 1 started (worker A)
15:17:11  agent finished step 4; SIGKILL worker A
15:17:28  worker B up
15:18:40  attempt 2 started (worker B)      <- Temporal: no heartbeat for 90 s, retry
15:18:55  money: REVIVED 20/20 on 3.13, 20/20 on 3.8, attempts 2
```

The ledger has both attempts' calls, 0.84 cents in total, because each step was written down
before the kill. Attempt 2 was told that an earlier attempt had been interrupted and to start with
`run_tests`. The full event history is
[in the repo](https://github.com/Bowen1314/pip-seance/tree/main/results/runs/chaos-deepseek-v4-flash-money).

## The Seances

| Medium (open weights, on Nebius) | Ghosts tried | Raised | Sound on my review | Left 3.8 broken | Cost |
|---|---|---|---|---|---|
| DeepSeek V4 Flash | 10 | **5** | 3 | 2 | $0.27 |
| Qwen3-30B-A3B-Instruct-2507 | 10 | 1 | 1 | 1 | $0.39 |
| GLM-5.3-Flash | 4 (the hardest) | 0 | 0 | 0 | $0.07 |
| DeepSeek V4 Flash, round 2 | 2 | 1 | 0 | 1 | $0.06 |

DeepSeek raised zipfile36, kafka, python3-ldap, null and money. Qwen raised null. Every raised
package still passes its tests on 3.8. Here's what the epitaphs say, beyond the table.

**Green isn't the same as alive.** I read every diff that turned the tests green. Three I would
merge as they are. kafka's vendored copy of `six` registers an import hook that only implements
`find_module`, which Python 3.12 stopped calling. DeepSeek added `find_spec`, `create_module` and
`exec_module`, which is the same shape as the fix `six` itself shipped in 1.16.0. python3-ldap and
null just needed `collections.abc`. The other three work, with a caveat. money's fallback for
`distutils.version` leans on `packaging`, which happens to be importable only because pytest
depends on it. And logutils' fix re-creates two private functions on the standard library's
`logging` module rather than in its own code.

**zipfile36 was never dead.** Its sdist carries its own copy of CPython's `test.support`, which
does `import nntplib`, and Python 3.13 removed `nntplib`. The library was fine; its test kit had
died. The medium first checked that the fence was real ("Let me check whether the test/support file
is truly read-only by attempting a small edit"), then wrote a 27-line `nntplib.py` stub so the old
test helper could import it. 168 out of 168, for one cent. That counts as raised by the rules, and
it's also the most honest result in the table: the most downloaded ghost wasn't a ghost.

**The cure and the clumsy hands.** cookies died because one of its regexes has `(?ix)`, a global
flag group, in the middle of a pattern, which has been an error since Python 3.11. DeepSeek
diagnosed it correctly and turned it into a scoped group, `(?ix:`. Then it had to close the
parenthesis at the other end of a multi-line pattern, and 8 of its next 9 edits were rejected
because the text it quoted wasn't in the file. It kept indenting the code two spaces too deep. My
guess is that it was counting the two-space gutter after my `read_file` line numbers. The budget
ran out with the parenthesis still open, and now the package didn't even import on 3.8. A failed
seance can leave the body worse than it found it. That's why each one works on a copy and checks
3.8 at the end.

**The medium is only as good as what it can see.** logutils died because Python 3.13 removed
`logging._acquireLock`. In the first bench no model found that, and none of them edited a single
file. The reason was my tool: `run_tests` led with `No module named 'redis'`, from a test that had
never been a target, and the real `AttributeError` had been cut from the tail I passed back. After
I changed `run_tests` to list each failing target with its own error message, DeepSeek raised
logutils in 10 steps for 1.6 cents. Because that's a different tool, I report it as round 2, not
mixed into the bench.

**The kill switch didn't kill.** The per-run cap originally called `abort()` from inside
`onStepFinish`. The bench showed that this doesn't end Mastra's loop: one Qwen run kept going to
$0.098 against a $0.04 cap. The cap is now a `stopWhen` condition, and every tool refuses work once
the run is over budget. I re-ran the same seance with the cap at $0.004 and it stopped at $0.0045,
one step over. The project-wide $1.00 cap held throughout, because it's checked before each seance
starts.

**GLM never got to speak.** GLM-5.3-Flash is a reasoning model. In three of its four seances it
spent the whole 4,096-token output budget thinking and ended with an empty reply. That row says
more about my `maxOutputTokens` than about GLM.

**Small isn't free.** Qwen3-30B-A3B has only 3B active parameters, small enough to run on a good
desktop GPU. It ran 40-step loops of `read_file` and `search`, and once it wrote its tool call as plain
text instead of calling the tool. It cost more than DeepSeek and raised one package.

## Why Does Open Innovation Matter?

This project only works because of open source, starting with the dead.

**The ghosts are open.** Every one of these packages can still be raised because its source
and its tests are still sitting on PyPI, eight to thirteen years after the last release, and the
license lets anyone fix it. A closed SDK whose vendor walked away in 2017 is just gone. The
`nntplib` stub, the `find_spec` fix and the `collections.abc` imports are all possible because
someone published the code.

**The mediums are open, and they'll still exist.** I compared three open-weight models from three
labs by changing one string, `nebius/<model id>`. The weights for every model in my table are
published, so this bench can be re-run against the same models in five years, or on my own
hardware if the provider disappears. That's the point of an experiment about software that
outlived its maintainers: I didn't want the medium to be the next thing that vanishes.

**Cheap enough to try on everything.** DeepSeek V4 Flash attempted all ten ghosts for 27 cents,
about 5 cents per package raised. The whole project, including smoke tests, the cap test, the
chaos test and round 2, cost **$0.83** across 523 model calls. At that price you can hold a seance
for every dead dependency in your lockfile and only read the diffs that come back green.

**Open frameworks let me see inside.** Mastra ships its documentation and provider registry
inside the npm package. That's how I found that Nebius was already a provider and which model ids
it knew. Temporal's dev server is a single open-source binary with no account, so the durability
test ran inside a batch job on a shared cluster. When something misbehaved, like the cap that
didn't stop the loop, I could read the types and fix my side instead of filing a ticket and
waiting.

What I'm not claiming: this isn't offline or private. The code went to a hosted inference
endpoint, as it would with a closed API. I also didn't run a closed model, so I can't tell you
open models are better at this. My claim is narrower: for this job, a model that costs about a
cent per attempt raised more than half the dead, and every part of the pipeline, from the ghosts
to the medium to the ritual, is something I could read, run and fix myself.

## My Agent Session

Instead of DevRelay, every seance's full session is in the repo as `transcript.jsonl`: each step's
tool calls, tool results and tokens. Three worth reading:

- [kafka, DeepSeek](https://github.com/Bowen1314/pip-seance/tree/main/results/runs/bench-deepseek-v4-flash-kafka):
  41 of 41 passing at step 8 for one cent. It then spent three more cents reading test files to
  make sure a leftover `SyntaxError` in a *non-target* test wasn't its fault, until the cap stopped
  it. Conscientious, and four times the price.
- [zipfile36, DeepSeek](https://github.com/Bowen1314/pip-seance/tree/main/results/runs/bench-deepseek-v4-flash-zipfile36):
  tries the read-only fence once, accepts it, writes the stub.
- [cookies, DeepSeek](https://github.com/Bowen1314/pip-seance/tree/main/results/runs/bench-deepseek-v4-flash-cookies):
  right diagnosis, eight rejected edits, one open parenthesis.

The agent that built pip-seance itself was Claude Code, working autonomously from a task brief.

## The Spirit of It

The moment it landed for me was kafka. 41 tests, zero passing on Python 3.13, the whole suite
failing at import with `No module named 'kafka.vendor.six.moves'`. Eight model calls later, all 41
passed on 3.13 *and* on 3.8, with the same shape of fix the `six` maintainers shipped for their own
library in 2021. The original authors moved on years ago, and the package is still installed
239,184 times a month. A one-cent seance gave it back to the people still using it.

None of these revivals are going upstream automatically, and they shouldn't. The epitaphs show
why: a green run can be a stub, a leaky fallback, or a fix in the wrong place. pip-seance doesn't
take over the job of maintaining these packages. It finds the dead, says what killed them, and
hands you a candidate fix with the evidence attached. If you depend on one of these ten, the
epitaph is a good place to start.

## Prize Categories

**Best Use of Mastra.** The medium is a Mastra `Agent` with six `createTool` tools, running
open-weight models through Mastra's model router (`nebius/<model id>`, with the key read from
`NEBIUS_API_KEY`). `onStepFinish` drives the live cost ledger, and `stopWhen` enforces the
per-seance budget. The same agent ran DeepSeek V4 Flash, Qwen3-30B-A3B and GLM-5.3-Flash with no
code changes. Notes from the build that might help the Mastra team:

1. Calling `abort()` on the `abortSignal` from inside `onStepFinish` didn't end a `generate()`
   loop for me (one run went 2.4x over its cap). A `stopWhen` predicate did.
2. With a reasoning model and `maxOutputTokens: 4096`, three runs ended on a step that used the
   full 4,096 output tokens and returned no text, so the loop simply stopped. A warning when a
   step's output is all reasoning would make that easier to spot.
3. The bundled provider registry lists Nebius models but not every current one (no
   `MiniMax-M3.1-Flash`, for example), so I picked models that were listed.

**Best Use of Temporal.** Each seance is a Temporal workflow: a heartbeating agent activity with
retries, then verify and epitaph activities. Deterministic workflow ids keep a crashed client from
paying twice. In the chaos test, the worker was SIGKILLed mid-seance, and Temporal handed the
activity to a new worker after the heartbeat timeout. That worker finished the seance in the same
workspace and raised `money` 20/20. The event history and the exact cost of both attempts are in
the repo.

---

*Built in one day, 27 October 2026, inside the challenge window. Numbers are from
[`results/SUMMARY.md`](https://github.com/Bowen1314/pip-seance/blob/main/results/SUMMARY.md) and
[`ledger/spend.jsonl`](https://github.com/Bowen1314/pip-seance/blob/main/ledger/spend.jsonl).
Package list: [hugovk/top-pypi-packages](https://github.com/hugovk/top-pypi-packages).*

# S12 replay benchmark — 3000 events

Scratch chain: <local-private-tmp>/claude-501/<local-project-dir>/f176a613-8a18-4330-8ef7-91d8ca65e63c/scratchpad/s12-bench/ws-3000/workspace
Read verbs × 5 runs each; median wall-clock in ms.
A FAILED <reasonCode> verdict means the verb refused (e.g. export's 1 MiB canonical
ceiling) — its timing is the wall-clock of the refusal, not a throughput number.

| verb | median ms | min ms | max ms | verdict |
| --- | --- | --- | --- | --- |
| status | 363 | 361.6 | 463.3 | ok |
| validate | 397.1 | 394.3 | 785 | ok |
| export | 421 | 418.7 | 425.9 | FAILED INPUT_OVERSIZED |
| work-list | 401.1 | 393.4 | 407 | ok |

Threshold (S12.3 rule): a common read verb median > 2000 ms triggers startup repair.

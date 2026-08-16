# S12 replay benchmark — 10k-ceiling events

Scratch chain: <local-private-tmp>/claude-501/<local-project-dir>/f176a613-8a18-4330-8ef7-91d8ca65e63c/scratchpad/s12-bench/ws-10000/workspace
Read verbs × 5 runs each; median wall-clock in ms.
A FAILED <reasonCode> verdict means the verb refused (e.g. export's 1 MiB canonical
ceiling) — its timing is the wall-clock of the refusal, not a throughput number.

| verb | median ms | min ms | max ms | verdict |
| --- | --- | --- | --- | --- |
| status | 440 | 396.1 | 473.1 | ok |
| validate | 371 | 368.1 | 371.4 | FAILED INPUT_OVERSIZED |
| export | 386 | 383.1 | 401.5 | FAILED INPUT_OVERSIZED |
| work-list | 367.8 | 364.5 | 384.3 | FAILED INPUT_OVERSIZED |

Threshold (S12.3 rule): a common read verb median > 2000 ms triggers startup repair.

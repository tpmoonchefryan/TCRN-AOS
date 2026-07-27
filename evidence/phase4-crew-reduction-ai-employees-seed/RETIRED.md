# These receipts cannot be reproduced

The six receipts in this directory were produced on 2026-07-07 by
`scripts/phase4-crew-reduction-ai-employees-seed-proof.mjs`, which was retired under
`TCRN-AOS-INC-002`. They record `ok: true` and name a command,
`pnpm --dir TCRN-AOS phase4:crew-ai-employees-seed-proof`, that no longer exists.

The receipts are kept because the run behind them happened; what is gone is the ability to
run it again. Its input — a 19-thread registry under a sibling `TCRN Workflow` directory —
was archived to a private Legacy repository and deleted on 2026-07-20, deliberately, and
this script's assertions hard-code that registry's exact census.

Read them as history, not as a gate. The projection code they exercised keeps live
coverage in `packages/db/test/phase1-sqlite-repository.test.mjs`. Reasoning in full:
`docs/retired-proof-scripts.md`.

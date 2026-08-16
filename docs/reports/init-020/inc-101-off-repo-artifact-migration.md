# INC-101 off-repo candidate migration

The QA4 candidate at `<local-home>/.tcrn-workflow/candidates/qa4-inc098-O0SToT`
is an isolated artifact, not a governed workspace and not an accepted helper
installation. Its exact path, purpose, lifecycle, origin posture, and measured
head are in `inc-101-off-repo-artifact-registry.json`.

Before the fifth acceptance input:

1. Rewrite every reachable candidate ref so the QA4 topology files contain no
   literal or encoded private host, runtime path, loopback, facade address, or
   obfuscation pattern. The proof scans all reachable commits; a clean working
   tree alone is insufficient.
2. Keep the candidate outside the platform repository roster. Do not copy it into
   `~/.agents/skills`, `~/.tcrn-workflow/`, or a governed workspace.
3. Keep the public `origin` absent. If a temporary remote is ever needed for a
   read-only comparison, remove it again and rerun the proof. A pre-push hook is
   an additional guard, not a substitute for removing an unintended public origin.
4. Re-pin the candidate through the helper trust procedure, then run the fifth
   acceptance against the exact rewritten head. Record the new head and commit
   count in the registry before asking Owner for release disposition.

The reversible local remediation is `git -C <candidate> remote remove origin`.
No push, tag publication, helper install, or governed-chain transition is part of
this procedure.

# AGENTS.md

The canonical agent guidance for this repository lives in `CLAUDE.md`. Open it before
changing any source. This file is a deliberate pointer, not a copy — keeping one source
avoids two-file drift.

Two rules you must not miss:

1. **Use the code graph (`codegraph`) instead of grep for structural questions — but run
   `codegraph status` first.** A stale index is worse than grep: grep is slow and honest,
   a stale index is fast and confidently wrong.
2. **If your host is missing an instrument this repository has, say so at the start.**
   Silently falling back to a slower method raises no error and hides the gap from
   everyone.

For everything else — host parity, verifying against the authority rather than a local
view, background-load reclaim, and the platform-wide conventions — see `CLAUDE.md`.

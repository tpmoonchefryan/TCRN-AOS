# AGENTS.md

The canonical agent guidance for this repository lives in `CLAUDE.md`. Open it before
changing any source. This file is a deliberate pointer, not a copy — keeping one source
avoids two-file drift.

Three rules you must not miss:

1. **This repository's governance chain is NOT on this machine.** Since 2026-07-29 the
   laptop is a pure client: the truth lives on host `tcrn-platform-dev`, the copy under
   `.tcrn-workspace/TCRN-AOS/` is a read-only archive that refuses every read and write
   verb by design, and a governance write from here is a remote ceremony
   (`deploy/aos-local-client/ceremony.mjs`, payload + at least one read-back). The address,
   the cockpit's shape, the backup direction and the retired mirror are all in `CLAUDE.md`'s
   first section — with a runnable recheck command per claim. Do not act on remembered
   addresses.
2. **Use the code graph (`codegraph`) instead of grep for structural questions — but run
   `codegraph status` first.** A stale index is worse than grep: grep is slow and honest,
   a stale index is fast and confidently wrong.
3. **If your host is missing an instrument this repository has, say so at the start.**
   Silently falling back to a slower method raises no error and hides the gap from
   everyone.

For everything else — host parity, verifying against the authority rather than a local
view, background-load reclaim, and the platform-wide conventions — see `CLAUDE.md`.

# CLAUDE.md — AOS agent entry

TCRN AOS. This file is a signpost for agents working in this repository; the real
reference is `README.md` and the docs under `docs/`.

## Instrument discipline

### 1. Use the code graph before grep — and check that it is fresh first

This repository is indexed by codegraph and exposed to Claude Code as an MCP server
(`codegraph-aos` in the platform's `.mcp.json`). **Known parity gap as of 2026-07-26:
the Codex side has only the TMS server configured in `~/.codex/config.toml`, so a Codex
session in this repository has no code graph.** Under rule 2 below, that is something to
name at the start of the work rather than work around silently.
For "where is X", "who calls X", "what breaks if I change X",
and for surveying an area, one `codegraph_explore` call replaces dozens of grep-and-read
round trips.

**But run `codegraph status` first.** A stale index is worse than grep: grep is slow and
honest, a stale index is fast and confidently wrong — it will answer today's question
from a snapshot of the code taken weeks ago, and it will not tell you. Confirm the index
is newer than the last commit; if it is not, `codegraph sync` (or `index`) before you
trust an answer.

The graph is an index, not the bytes. When the question is "what exactly does this line
say", read the file.

### 2. Host parity: a missing instrument is something you say out loud

Claude Code and Codex must carry the same tool roster for this repository. If the host
you are running under is missing an instrument this repository already has, **raise it
at the start of the work** rather than silently falling back to a slower method. A silent
downgrade raises no error; it just leaves everyone believing that is this repository's
normal working speed. This is not hypothetical — the code graph was configured under
`~/.codex/` only, and five consecutive Initiatives elsewhere on this platform ran entirely
on grep without anyone noticing what was missing.

### 3. Verify "did it reach elsewhere" against the authority, and compare full values

- Whether a branch or tag reached the remote: ask the server (`git ls-remote`). Do **not**
  use `git log --not --remotes` — under a narrow fetch refspec it can never see a
  newly pushed branch.
- Comparing commits: compare **full** SHAs. An 8-character local id against a 7-character
  server-truncated one reports a difference that does not exist.
- Dating something: measure against a reference that does not move (the other file's own
  write time), never against the wall clock as it is right now.

### 4. Background loads: write the reclaim in the same breath as the spawn

Dev servers, watchers, headless browsers, load generators — the teardown belongs in the
same command or flow (`trap 'kill 0' EXIT`, or capture the process **group** and kill it).
Verify the group is empty when you are done. Killing the direct child is not enough: a
pnpm/npm shim chain lets the real binary reparent to init and survive. A daemon the tool
registers itself (codegraph writes `.codegraph/daemon.pid`) is not a leak — the test is
whether anything owns the record of it.

## Platform conventions

This repository lives inside the TCRN Platform working tree. Cross-repo conventions —
constraint classification and evolution, direction/track choices, sourcing and vetting of
outside code, delivery cadence — live in the platform root's `CLAUDE.md` and `docs/`.
Three that bite most often here:

1. **Replacing old logic requires a residual-applicability analysis first.** Ask whether
   the old path still holds for some supported user, host, or model. If it does, make the
   change conditional rather than deleting; if it does not, delete and record why.
2. **Direction choices are settled before the work starts** — anything hard to reverse
   (schema, public API contract, data model, platform choice), anything visible to
   external consumers or tenants, anything that forecloses an alternative architecture.
3. **Look for an existing solution before building one**: this repository first, then
   already-wired tools and existing dependencies, then outside open source — and outside
   code passes licence, supply-chain, hallucinated-package-name, and operating-cost review
   before it is adopted.

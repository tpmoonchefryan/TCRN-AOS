# CLAUDE.md — AOS agent entry

TCRN AOS. This file is a signpost for agents working in this repository; the real
reference is `README.md` and the docs under `docs/`.

## Read this first: this repository's governance chain is local again

Since 2026-08-08 (`INIT-020 S199`) **this laptop is the live file host of the AOS
governance chain.** The former VM address is a vacated archive; the local purity gate
now measures all five local live trees plus the declared fallback shadows.

The row below is a checked declaration, not prose — run the recheck command (via the MCP read face),
do not trust the sentence:

<!-- TOPOLOGY-CLAIMS:BEGIN -->

| 分区 | home | 真值地址 | 复核命令 |
| --- | --- | --- | --- |
| `TCRN-AOS` | `local` | `.tcrn-workspace/TCRN-AOS/workspace` | `本机引擎只读: status --workspace .tcrn-workspace/TCRN-AOS/workspace · 真值地址 .tcrn-workspace/TCRN-AOS/workspace` |

<!-- TOPOLOGY-CLAIMS:END -->

**INIT-020 S199 (2026-08-08):五链数据平面已回迁本机 file 后端。** 回迁前完成
逐事件、头哈希与知识库 marker 核对；VM 旧地址均已由引擎标记为
`WORKSPACE_RELOCATION_VACATED`。普通治理读写应使用本机已安装引擎；Owner 收口前
仍不得作发布或推送。

`home` is `local`, meaning this laptop. The chain's sidecars sit beside the local tree:
`attestations/` is the workspace root's **sibling** inside the partition directory (the
engine refuses an attest-dir inside the workspace itself), and `release-trust/` is a
sibling of the **partition** directory, one level further out — verified 2026-07-30 by
listing the container, which holds exactly those two entries. The engine
serving that chain is at `/srv/tcrn/engine/tcrn-workflow` — **`v0.9.0` as measured
2026-07-30**, and that number is a staleness hint for this file, not an authority; ask
its own `commands` catalogue.

Four consequences, all of which have already bitten:

1. **The five local trees are the live authorities.** The VM copies are retained as
   vacated archives and all four read faces there return `WORKSPACE_RELOCATION_VACATED`.
2. **A governance write from here uses the local engine.** Read the live head immediately
   before a mutation, use the engine's CAS, and retain the readback receipt. The VM
   ceremony is reserved for archive/host operations and is not the ordinary local write
   path.
3. **The cockpit is a resident systemd unit on the VM**, `tcrn-aos-cockpit`, bound to
   `127.0.0.1:4318` and **reachable only through an SSH tunnel** (`CONF-007` D7 — the bind
   is hard-coded in `apps/cockpit-service/src/service.ts` and no environment variable moves
   it). The domain store moved with it, to `/srv/tcrn/aos-cockpit/data/domain.db`; the copy
   under `~/.tcrn-aos/` is a sentinelled archive. **The LAN static mirror is retired and
   its route is gone** — any instruction still naming a `.lan` host is stale text, see
   `deploy/aos-mirror-retirement/`.
4. **Paired backups are taken on the VM** (both halves on one host) and **pulled to this
   machine** as the off-site copy. Pull, not push: `MIN-007` D9's original push direction
   was re-ruled because the credentials are asymmetric. `pnpm paired:backup`,
   `pnpm paired:backup-verify-offsite`.

**Topology is stated in exactly one place in this repository**:
`deploy/aos-local-client/topology.mjs`, whose VM half is *imported* from
`deploy/aos-resident-cockpit/manifest.mjs` (the constants already rendered into the live
systemd unit) rather than copied. Do not hand-type an address into a new script — import
it, or the first person to move the truth root leaves the service and your script pointing
at different machines with nothing going red.

Two gates in `pnpm verify` hold this down, and both assert **both directions**:
`pnpm local-purity:proof` (no live control tree here for a partition whose truth moved
away; since 2026-08-03 every partition has moved, so the local host is a pure client
holding zero live trees) and
`pnpm doc-topology:proof` (every registered platform document's location claim matches the
roster and the engine's real answer).

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

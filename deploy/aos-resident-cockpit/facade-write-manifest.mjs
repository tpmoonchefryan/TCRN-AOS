// STORY-184 — the declarative manifest for the facade WRITE service.
//
// The write facade is the loopback resident that fronts the engine's governed
// write verbs as ONE ceremony endpoint (POST /api/ceremony), driving the engine
// CLI in-process on the host where the chains live. It is a distinct systemd
// unit (single-point rollback) from the read facade (STORY-181) and from the
// cockpit, and it binds 127.0.0.1 behind the SSH tunnel — the same shape CONF-007
// D7 rules for the write face. Everything about where it lives, what it is handed,
// and what must stay true of it is stated here once; the apply recipe reads this
// file and never its own copy of a path.
//
// The five partition workspace paths AND their attestation sidecars come from
// aos-partitions.mjs (the single roster), passed through the same `workspaces` /
// `attestDirs` record shapes startFacadeWriteService demands — so a read and a
// write agree on where a chain lives, and a write ceremony attests into the
// sidecar beside the chain it writes (never inside it).

import { VM_ENGINE, VM_HOST } from "./manifest.mjs";
import { AOS_PARTITIONS } from "../aos-local-client/aos-partitions.mjs";
import { FACADE_PG_CONNECTION, FACADE_PG_SCHEMAS } from "./facade-read-manifest.mjs";

export const FACADE_WRITE_HOST = "127.0.0.1";
/** Distinct from the read facade's 4320; both are loopback-behind-SSH. */
export const FACADE_WRITE_PORT = 4321;

/** Deployment root on the VM. Separate from the read facade's and the cockpit's. */
export const FACADE_WRITE_ROOT = "/srv/tcrn/aos-facade-write";
export const FACADE_WRITE_RUNTIME = `${FACADE_WRITE_ROOT}/runtime`;
/** Where payloads and receipts are materialised, tool-owned (the caller names neither). */
export const FACADE_WRITE_EVIDENCE = `${FACADE_WRITE_ROOT}/evidence`;
export const FACADE_WRITE_UNIT_NAME = "tcrn-aos-facade-write.service";
export const FACADE_WRITE_UNIT_PATH = `/etc/systemd/system/${FACADE_WRITE_UNIT_NAME}`;

/** The engine whose catalogue drives the write whitelist and whose CLI performs every write. */
export const FACADE_WRITE_ENGINE = VM_ENGINE;

/** EPIC-041: the ceremony actor must be an attributed actor; agent:fable is the standing AI one. */
export const FACADE_WRITE_ACTOR = "agent:fable";

/**
 * Five partitions, one seam. A partition id maps to its workspace path AND its
 * attestation sidecar on this host, exactly the record shapes
 * startFacadeWriteService.workspaces / .attestDirs carry. Derived from
 * aos-partitions.mjs, never hand-typed here.
 */
export const FACADE_WRITE_WORKSPACES = Object.freeze(
  Object.fromEntries(Object.entries(AOS_PARTITIONS).map(([id, entry]) => [id, entry.workspace]))
);
export const FACADE_WRITE_ATTEST_DIRS = Object.freeze(
  Object.fromEntries(Object.entries(AOS_PARTITIONS).map(([id, entry]) => [id, entry.attestDir]))
);

/** Host allow-list: the loopback tunnel's destinations. */
export const FACADE_WRITE_ALLOWED_HOSTS = Object.freeze([FACADE_WRITE_HOST, "localhost"]);

/**
 * A JSON value rendered for a systemd `Environment=` line.
 *
 * systemd's unit parser strips the double quotes out of an unquoted value
 * (measured on the VM: `Environment=X={"a":"b"}` lands as `X={a:b}`), so a JSON
 * object must be wrapped in outer quotes with each inner quote escaped as `\"`.
 * This renders exactly what `JSON.stringify` produced, untouched by the unit
 * parser.
 */
export function systemdJsonEnv(value) {
  return `"${JSON.stringify(value).replace(/"/g, '\\"')}"`;
}

export function renderFacadeWriteUnit() {
  return `[Unit]
Description=TCRN AOS facade write service (STORY-182; one ceremony endpoint, loopback only, no pins)
Documentation=file://${FACADE_WRITE_ROOT}/DEPLOYMENT.md
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
WorkingDirectory=${FACADE_WRITE_RUNTIME}
ExecStart=/usr/local/bin/node ${FACADE_WRITE_RUNTIME}/deploy/aos-resident-cockpit/facade-write-runner.mjs
# The write facade drives the engine CLI in-process against the governance tree,
# which the relocation ceremony keeps at 0700 root:root — so, like the read face
# and the cockpit, this process must run as root to traverse to the chains it
# writes. It still holds no pins and accepts no authority argument (the source
# gate asserts both at the bytes); the only write path is the one ceremony
# endpoint, and every write is a payload of steps plus a read-back.
User=root
# After the switch window the write facade drives the engine CLI against the
# PG-backed chain as the tcrn_engine role via sudo -u tcrn_engine (PG socket
# peer auth). That is a privilege DECREASE from root, so NoNewPrivileges is
# lifted for this one downward hop — the process never gains a privilege it did
# not already hold.
NoNewPrivileges=no
Environment=FACADE_WRITE_ENGINE=${FACADE_WRITE_ENGINE}
Environment=FACADE_WRITE_HOST=${FACADE_WRITE_HOST}
Environment=FACADE_WRITE_PORT=${FACADE_WRITE_PORT}
Environment=FACADE_WRITE_ROOT=${FACADE_WRITE_ROOT}
Environment=FACADE_WRITE_EVIDENCE=${FACADE_WRITE_EVIDENCE}
Environment=FACADE_WRITE_WORKSPACES=${systemdJsonEnv(FACADE_WRITE_WORKSPACES)}
Environment=FACADE_WRITE_ATTEST_DIRS=${systemdJsonEnv(FACADE_WRITE_ATTEST_DIRS)}
Environment=FACADE_WRITE_ALLOWED_HOSTS=${FACADE_WRITE_ALLOWED_HOSTS.join(",")}
Environment=FACADE_WRITE_ACTOR=${FACADE_WRITE_ACTOR}
Environment=FACADE_PG_SCHEMAS=${systemdJsonEnv(FACADE_PG_SCHEMAS)}
Environment=FACADE_PG_CONNECTION=${FACADE_PG_CONNECTION}
Restart=on-failure
RestartSec=5
ProtectSystem=full
ReadWritePaths=/srv/tcrn
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tcrn-aos-facade-write

[Install]
WantedBy=multi-user.target
`;
}

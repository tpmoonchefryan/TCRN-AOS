// STORY-181 — the declarative manifest for the facade read service.
//
// The facade is the loopback resident that fronts the engine's read verbs. It is
// a distinct systemd unit (single-point rollback) from the LAN read face, and it
// binds 127.0.0.1 behind the SSH tunnel — the same shape CONF-007 D7 rules for
// the write face. Everything about where it lives, what it is handed, and what
// must stay true of it is stated here once; the apply recipe reads this file and
// never its own copy of a path.
//
// The five partition workspace paths come from aos-partitions.mjs (the single
// roster), passed through the same `workspaces` record shape the write face's
// CockpitServiceOptions uses — so a read and a write agree on where a chain lives.

import { VM_ENGINE, VM_HOST } from "./manifest.mjs";
import { AOS_PARTITIONS } from "../aos-local-client/aos-partitions.mjs";

export const FACADE_HOST = "127.0.0.1";
export const FACADE_PORT = 4320;

/** Deployment root on the VM. Separate from the cockpit's and the LAN read face's. */
export const FACADE_ROOT = "/srv/tcrn/aos-facade-read";
export const FACADE_RUNTIME = `${FACADE_ROOT}/runtime`;
export const FACADE_UNIT_NAME = "tcrn-aos-facade-read.service";
export const FACADE_UNIT_PATH = `/etc/systemd/system/${FACADE_UNIT_NAME}`;

/** The engine whose catalogue drives the tool table and whose CLI answers every read. */
export const FACADE_ENGINE = VM_ENGINE;

/**
 * Five partitions, one seam. A partition id maps to the workspace path its chain
 * lives at on this host, exactly the record shape the write face's
 * CockpitServiceOptions.workspaces carries. Derived from aos-partitions.mjs,
 * never hand-typed here.
 */
export const FACADE_WORKSPACES = Object.freeze(
  Object.fromEntries(Object.entries(AOS_PARTITIONS).map(([id, entry]) => [id, entry.workspace]))
);

/**
 * STORY-189 switch window: the Postgres schema holding each partition's chain
 * after the file→pg migration. Stated here once — the engine CLI serves a
 * PG-backed chain when TCRN_PG_SCHEMA is set alongside TCRN_PG_CONNECTION. The
 * five schemas were created by the chain-ddl.sql application (STORY-188); their
 * names are chain_<short> in the form the window driver chose, which has no
 * uniform derivation from the partition id, so they are listed explicitly.
 */
export const FACADE_PG_SCHEMAS = Object.freeze({
  "TCRN-AOS": "chain_aos",
  "Joi-Button": "chain_joi",
  "cross-project": "chain_cross",
  "TCRN-Design-System": "chain_ds",
  "TCRN-TMS": "chain_tms",
});

/** Host allow-list: the loopback tunnel's destinations. */
export const FACADE_ALLOWED_HOSTS = Object.freeze([FACADE_HOST, "localhost"]);

/**
 * The Postgres peer-auth connection the facade's engine CLI uses after the
 * switch window. Socket peer on the VM: the CLI runs as the tcrn_engine role,
 * so no password crosses the loopback.
 */
export const FACADE_PG_CONNECTION = "postgresql:///tcrn_governance?host=/var/run/postgresql";

export function renderFacadeUnit() {
  return `[Unit]
Description=TCRN AOS facade read service (STORY-181; engine read verbs, loopback only, no pins)
Documentation=file://${FACADE_ROOT}/DEPLOYMENT.md
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
WorkingDirectory=${FACADE_RUNTIME}
ExecStart=/usr/local/bin/node ${FACADE_RUNTIME}/deploy/aos-resident-cockpit/facade-read-runner.mjs
# DynamicUser gives a low-privilege, ephemeral, isolated process. The facade reads
# the governance tree, which the relocation ceremony keeps at 0700 root:root — so
# like the write face, this process must run as root to traverse to the chains it
# reads. It still holds no pins and forwards no mutating verb (the source gate
# asserts both at the bytes).
User=root
# After the switch window the facade serves the chains from Postgres: each read
# verb runs the engine CLI as the tcrn_engine role via sudo -u tcrn_engine
# (PG socket peer auth). That is a privilege DECREASE from root, so the
# NoNewPrivileges guard is lifted for this one downward hop — the facade never
# gains a privilege it did not already hold.
NoNewPrivileges=no
Environment=FACADE_HOST=${FACADE_HOST}
Environment=FACADE_PORT=${FACADE_PORT}
Environment=FACADE_ENGINE=${FACADE_ENGINE}
Environment=FACADE_WORKSPACES_B64=${Buffer.from(JSON.stringify(FACADE_WORKSPACES), "utf8").toString("base64")}
Environment=FACADE_ALLOWED_HOSTS=${FACADE_ALLOWED_HOSTS.join(",")}
Environment=FACADE_PG_SCHEMAS_B64=${Buffer.from(JSON.stringify(FACADE_PG_SCHEMAS), "utf8").toString("base64")}
Environment=FACADE_PG_CONNECTION=${FACADE_PG_CONNECTION}
Restart=on-failure
RestartSec=5
ProtectSystem=full
ReadWritePaths=/srv/tcrn
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tcrn-aos-facade-read

[Install]
WantedBy=multi-user.target
`;
}

// TCRN-AOS-STORY-132 — the declarative manifest for the resident VM cockpit.
//
// Owner ruling: the cockpit is RESIDENT (that UI is the whole point of mode A),
// so it stops being something an operator starts by hand and becomes a unit the
// machine brings up by itself. Everything about where it lives, what it is
// handed, and what must stay true of it is stated here once; the recipes read
// this file and never their own copy of a path.
//
// Two things this file deliberately is NOT:
//   - it is not a place to put a value that differs per run. The only rendered
//     value is the pins file digest, and it is derived from bytes, not chosen;
//   - it is not the authority for the loopback bind. That is hard-coded in
//     apps/cockpit-service/src/service.ts and no environment variable can move
//     it (CONF-007 D7). The manifest carries the PREDICATE for it, not a knob.

export const VM_HOST = "tcrn-platform-dev";

/** The relocated truth root, as the chain's own control record declares it. */
export const VM_WORKSPACE = "/srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace";
/** Sibling of the workspace root, never inside it — the engine refuses inside. */
export const VM_ATTEST_DIR = "/srv/tcrn/governance/tcrn-workspace/TCRN-AOS/attestations";
export const VM_ENGINE = "/srv/tcrn/engine/tcrn-workflow";
export const VM_ENGINE_MCP = `${VM_ENGINE}/scripts/tcrn-workflow-mcp.mjs`;

/** The deployment root. Data, code and authority are separate subtrees. */
export const VM_ROOT = "/srv/tcrn/aos-cockpit";
export const VM_RUNTIME = `${VM_ROOT}/runtime`;
export const VM_WEB = `${VM_RUNTIME}/web`;
export const VM_AUTHORITY_DIR = `${VM_ROOT}/authority`;
export const VM_AUTHORITY_BUNDLE = `${VM_AUTHORITY_DIR}/operator-authority.json`;
export const VM_AUTHORITY_PINS = `${VM_AUTHORITY_DIR}/operator-authority-pins.json`;
/**
 * The precious store's address on the VM.
 *
 * Outside `runtime/`, which is rsynced with `--delete`: a redeploy must not be
 * able to reach the one store on this platform that cannot be rebuilt.
 */
export const VM_DATA_DIR = `${VM_ROOT}/data`;
export const VM_DOMAIN_DB = `${VM_DATA_DIR}/domain.db`;

/**
 * Where the PRIMARY paired backups live, now that both halves are on this host
 * (TCRN-AOS-INC-045).
 *
 * A subdirectory rather than `/srv/tcrn/backups` itself, and the reason is a
 * semantic inversion worth keeping visible: that directory holds one pair pushed
 * up from the laptop while the truth still lived there, back when the VM was the
 * OFF-SITE side. The direction has reversed, so a new pair landing beside that one
 * would put a primary and an off-site copy in the same listing under names that
 * cannot be told apart. Rotation of the primaries is scoped to this subtree and so
 * cannot reach the historical push either.
 */
export const VM_PAIR_ROOT = "/srv/tcrn/backups/pairs";

export const PARTITION_ID = "TCRN-AOS";
export const ACTOR = "agent:fable";
export const PORT = 4318;
export const BIND_ADDRESS = "127.0.0.1";

export const UNIT_NAME = "tcrn-aos-cockpit.service";
export const UNIT_PATH = `/etc/systemd/system/${UNIT_NAME}`;
export const NODE_BINARY = "/usr/local/bin/node";
export const RUNNER = `${VM_RUNTIME}/vm-resident-runner.mjs`;

/**
 * The eleven cockpit modules and the view each one must render.
 *
 * Naming the expected view per route is what makes the walkthrough a judgement:
 * an unknown path falls back to the shell document by design, so "200 and some
 * HTML" is satisfied by the very failure the walkthrough exists to catch.
 */
export const MODULE_VIEWS = Object.freeze([
  ["/my-work", "my-work"], ["/inbox", "inbox"], ["/dashboard", "dashboard"],
  ["/projects", "projects"], ["/work-items", "work-items"], ["/board", "board"],
  ["/release-trains", "release-trains"], ["/knowledge", "knowledge"],
  ["/deliberations", "deliberations"], ["/audit", "audit"], ["/snapshots", "snapshots"]
]);

/**
 * The unit, rendered from one derived value.
 *
 * `User=root` is not a convenience. `/srv/tcrn/governance` is mode 0700 root:root
 * — the relocation ceremony put it there — so no unprivileged account can even
 * traverse to the chain this service writes. Running as a lesser user would need
 * the governance tree's ownership changed, which is a decision about the truth
 * root's containment and not one a deployment recipe gets to make on the way past.
 *
 * `Restart=on-failure` with a start limit, not `always`: the STORY-112 refusal
 * (no AOS_ACTOR, no service) exits non-zero on purpose, and an unbounded restart
 * would turn a stated misconfiguration into an invisible loop. Five attempts and
 * the unit sits in `failed`, where `systemctl status` says why.
 */
export function renderUnit({ pinsFileDigest }) {
  if (!/^[0-9a-f]{64}$/u.test(String(pinsFileDigest ?? ""))) {
    throw new Error("renderUnit needs the pins file sha256; refusing to render a unit with an unverifiable authority");
  }
  return `[Unit]
Description=TCRN AOS operations cockpit (resident write face, loopback only)
Documentation=file://${VM_ROOT}/DEPLOYMENT.md
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
WorkingDirectory=${VM_RUNTIME}
ExecStart=${NODE_BINARY} ${RUNNER}
User=root
Environment=AOS_ACTOR=${ACTOR}
Environment=AOS_PORT=${PORT}
Environment=AOS_STATIC_ROOT=${VM_WEB}
Environment=AOS_DOMAIN_DB=${VM_DOMAIN_DB}
Environment=AOS_WORKSPACE=${VM_WORKSPACE}
Environment=AOS_ATTEST_DIR=${VM_ATTEST_DIR}
Environment=AOS_ENGINE_MCP=${VM_ENGINE_MCP}
Environment=AOS_AUTHORITY_PINS=${VM_AUTHORITY_PINS}
Environment=AOS_AUTHORITY_PINS_DIGEST=${pinsFileDigest}
Restart=on-failure
RestartSec=5
NoNewPrivileges=yes
ProtectSystem=full
ReadWritePaths=/srv/tcrn
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tcrn-aos-cockpit

[Install]
WantedBy=multi-user.target
`;
}

/**
 * Environment the unit must state, as key/value pairs, derived from the unit text.
 *
 * Read back out of the rendered bytes rather than kept as a second list: a
 * checklist maintained beside the thing it checks is a checklist that drifts.
 */
export function unitEnvironment(unitText) {
  return Object.fromEntries(String(unitText).split("\n")
    .filter((line) => line.startsWith("Environment="))
    .map((line) => {
      const body = line.slice("Environment=".length);
      const at = body.indexOf("=");
      return [body.slice(0, at), body.slice(at + 1)];
    }));
}

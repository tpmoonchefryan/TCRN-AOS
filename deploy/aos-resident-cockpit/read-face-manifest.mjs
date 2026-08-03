// STORY-140 — the read-only LAN face's declarative manifest.
//
// The read face is the LAN path to the workbench: it serves the resident
// cockpit's web and reads its domain store, but it has no write capability
// (STORY-138) and is bound to a concrete LAN interface rather than loopback or
// wildcard (MIN-014). Every address and the unit text come from here; the apply
// recipe reads this file and never its own copy of a path.

export const VM_HOST = "tcrn-platform-dev";

/** The VM's LAN interface address (ens224). A concrete bind, never a wildcard. */
export const READ_HOST = "192.168.51.249";
export const READ_PORT = 4319;

/** Deployment root on the VM. Separate from the cockpit's /srv/tcrn/aos-cockpit. */
export const READ_ROOT = "/srv/tcrn/aos-read";
export const READ_RUNTIME = `${READ_ROOT}/runtime`;
export const READ_UNIT_NAME = "tcrn-aos-read.service";
export const READ_UNIT_PATH = `/etc/systemd/system/${READ_UNIT_NAME}`;

/**
 * The resident cockpit's web and domain store, read-only.
 *
 * The read face does NOT own a second build or a second store — it serves the
 * same built web the write face serves (identical cockpitData, identical
 * freshness) and opens the same precious store read-only. Duplicating either
 * would let the read face drift from what the Owner sees over SSH.
 */
export const READ_STATIC_ROOT = "/srv/tcrn/aos-cockpit/runtime/web";
export const READ_DOMAIN_DB = "/srv/tcrn/aos-cockpit/data/domain.db";

/** Host header allow-list (anti-DNS-rebinding); the LAN IP the browser resolves. */
export const READ_ALLOWED_HOSTS = [READ_HOST];

export function renderReadUnit() {
  return `[Unit]
Description=TCRN AOS read-only LAN face (STORY-140; no pins, read routes only)
Documentation=file://${READ_ROOT}/DEPLOYMENT.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${READ_RUNTIME}
ExecStart=/usr/local/bin/node ${READ_RUNTIME}/read-face-runner.mjs
# DynamicUser gives a low-privilege, ephemeral, isolated process (MIN-014: the
# LAN-exposed process must not be a privileged one). It needs only read access,
# and the web + domain store are world-readable.
User=aosread
DynamicUser=yes
Environment=AOS_READ_HOST=${READ_HOST}
Environment=AOS_READ_PORT=${READ_PORT}
Environment=AOS_STATIC_ROOT=${READ_STATIC_ROOT}
Environment=AOS_DOMAIN_DB=${READ_DOMAIN_DB}
Environment=AOS_ALLOWED_HOSTS=${READ_ALLOWED_HOSTS.join(",")}
Restart=on-failure
RestartSec=5
NoNewPrivileges=yes
ProtectSystem=full
ProtectHome=yes
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tcrn-aos-read

[Install]
WantedBy=multi-user.target
`;
}

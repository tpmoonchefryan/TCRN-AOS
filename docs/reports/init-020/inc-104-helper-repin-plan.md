# INC-104 helper repin plan

This is a read-only handoff. The installed helper state is stale relative to the
QA4 candidate and must not be repaired by editing helper-owned control or
provenance files.

Measured on 2026-08-07:

- helper provenance: `0.10.2` / `v0.10.2`;
- installed Claude copy marker: `v0.10.2`;
- installed Codex copy marker: `v0.5.0`;
- QA4 candidate: exact rewritten local head is recorded in
  `inc-101-off-repo-artifact-registry.json`;
- candidate origin is absent and its reachable history has passed the targeted
  topology privacy proof.

Owner-gated sequence:

1. Run the `tcrn-workflow-helper` trust/preflight checks against the exact
   candidate head and verify its release-byte digest.
2. Obtain explicit Owner approval for the mutating helper repin. If dependency
   acquisition is needed, obtain the separate `plan-network` approval required
   by the helper trust gate.
3. Let the helper engine update the Claude and Codex installed-copy markers and
   provenance; do not hand-edit `~/.tcrn-workflow/**`.
4. Rerun the installed-copy/provenance proof, candidate privacy proof, and fifth
   acceptance. Leave Codex hook activation and user-level config cleanup as a
   separate Owner decision.

The read-only machine form is `pnpm --dir TCRN-AOS helper-repin:plan`.

## 2026-08-09 completion readback

The measured stale state above is historical. Owner ruling three is recorded in
`AUTHORIZATION-2026-08-09-owner-prod.md` and approved the repin immediately after
the `v0.11.8` annotated tag was minted. The authorized sequence was completed:

- the helper candidate was raised to `0.1.0-candidate.31` and its Workflow
  identity/provenance was rebound to `v0.11.8`;
- both installed-copy markers were verified through the trusted bootstrap as
  `INSTALLED_COPY_VALIDATED` for `v0.11.8`;
- the current machine result is `HELPER_REPIN_VERIFIED`, and `prod:ready`
  reports `HELPER_ENGINE_PIN_VERIFIED`;
- the proof packet is
  `inc-113-helper-repin-proof-2026-08-09.json`.

No helper control tree was edited by hand, and no remote or public ref was
published.

# Security And Privacy Boundaries

The current local checkpoint stores references and posture records, not raw private payloads.

Rejected or redacted input classes include:

- credentials and token-shaped values
- private key material
- raw secret scan output
- shell history markers
- browser or keychain material
- raw source diffs
- machine-local absolute path dumps
- restricted evidence bodies

Owner-intent-required actions are modeled as pending gates. They are not executed automatically by the gateway or adapter.

The Codex adapter is dry-run only. It records intended dispatch payloads and readback models, but it does not send to live threads in this checkpoint.

Slice 2 runtime proof uses ephemeral local fixture storage and a loopback-only short-lived service. The proof scripts do not retain runtime DB files, start external queues, execute copied helpers, or store local absolute path dumps in AOS records.

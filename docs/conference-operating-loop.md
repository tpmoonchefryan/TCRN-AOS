# Conference And AI Operating Loop

Slice 5 adds a local, inspectable operating loop for conference-driven AI employee work. It is a product-local functional checkpoint, not live automation.

## Local Contract

- `WorkIndexDrillThrough` links a selected story to assignments, gates, conferences, evidence, audit events, allowed local actions, and blocked action reasons.
- `LocalConferenceOperatingLoop` links a conference to ticket ids, initiator, participants, dry-run invite dispatch ids, missing participant readbacks, position ids, minutes status, outcome class, and the fixed no-live-dispatch booleans.
- `aos.work_index.drill_through.read` returns read-only drill-through state.
- `aos.conference.minutes.record` records local minutes metadata and decision history. It does not create action-item automation.
- Codex Adapter `conference_invite` dispatches remain dry-run outbox records and are linked to conference readbacks. `sendLive()` remains blocked.

## Deterministic Scenarios

`pnpm slice5:proof` exercises:

- `conference_requested`: dry-run invites are created and missing participant readbacks are visible.
- `positions_collecting`: one position is recorded, another participant remains missing, and the missing response is not inferred as failure.
- `minutes_recorded`: minutes/outcome metadata is recorded locally with no action-item automation.
- `owner_intent_required`: Owner Intent remains a blocked human gate, not an automatic action.
- `stale_route_followup`: stale invitation/readback state is surfaced as local follow-up metadata.

## Boundaries

Slice 5 does not authorize live Codex dispatch, thread registry mutation, copied-helper execution, deployment, external queue/server proof, Product Design final visual acceptance, browser acceptance closeout, release readiness, product acceptance, final MVP acceptance, scanner ingestion, resource materialization, or remote publication.

# Samurai Owner Pairing UX Hardening

Date: 2026-09-04
Scope: owner mobile UI only. Production `main` is intentionally untouched by this branch.

## Verified defects

1. The current public owner UI renders `0` beside every Life OS category before a device has authenticated and fetched a canonical `life_index`. Those zeros are placeholders, not evidence that durable memory is empty.
2. The older `samurai-state/index.html` requires legacy `?c=<channel>#k=<key>` pairing parameters. Opening it without those parameters correctly produces `pairing link incomplete`, but that page should no longer be presented as the normal owner entry point.
3. Current pairing v2 is per-device. `pair_start` creates a PENDING record; a private BossHome worker must consume `pair_next` and call `pair_complete`. If the worker is not processing pair approvals, the browser waits until timeout.
4. Backend state at audit time: 1 APPROVED device, 3 REVOKED devices, 0 PENDING devices.

## Required UI changes

- Initial Life OS category values must display `—` rather than `0` while the device is unpaired or while the canonical Life Index has not loaded.
- Initial Life Index footer must say `Pair this device to load canonical Life Index.`
- Only `applyLifeIndex()` may promote displayed category counts to numeric canonical values after an authenticated encrypted response.
- On successful `activate()`, refresh the Life Index immediately and show a distinct `Loading canonical Life Index…` state until the response arrives.
- On Life Index failure, display `Canonical Life Index unavailable — no counts assumed.` rather than retaining stale local zeros.
- Do not use local capture counters as a substitute for canonical durable counts.

## Pairing continuity changes

- Preserve current per-device encrypted pairing as the active design.
- Retire the old URL-carried key/channel page from normal owner navigation.
- Add explicit states: UNPAIRED, PAIRING_PENDING, APPROVED_LOADING_INDEX, CONNECTED, REVOKED, ERROR.
- If a stored device is REVOKED, clear only that device's browser identity and offer a new pairing request; never silently treat it as approved.
- Pairing approval must remain a private-owner/BossHome action; public clients cannot self-approve.

## Security hardening

- The Edge Function currently relies on custom device/worker authentication with platform JWT verification disabled.
- Move the internal worker credential out of source code into a managed secret/environment variable and rotate the current value.
- Keep service-role access server-side only.
- Re-test pair_start, pair_status, pair_next, pair_complete, send, poll after secret rotation.
- Do not expose internal worker/channel credential values in browser code, logs, documentation, or Samer AI memory.

## Acceptance tests

1. Fresh private/incognito browser: all Life OS counters show `—`, not zero.
2. Click `Connect this phone securely`: one PENDING device record is created.
3. BossHome worker sees the pending device and approves it through the private worker path.
4. Browser transitions to APPROVED without reload.
5. Canonical Life Index loads and only then numeric counts appear.
6. Send a text mission; encrypted relay reaches BossHome and returns a result.
7. Send a voice mission; encrypted audio is processed and the mission result returns.
8. Reopen the same browser: approved device survives and reconnects.
9. Revoke the device: browser detects REVOKED and requires a new pairing.
10. The legacy `samurai-state` preview is no longer linked as the primary owner entry surface.

## Promotion rule

Do not merge to `main` until all ten acceptance tests pass against the current Supabase `samerai-mobile` function and the active BossHome worker.
/**
 * The defect inventory this harness was built to hold.
 *
 * Every id here is a check in `e2e/smoke.mjs` that fails against the app as it
 * stands today. Listing it keeps `yarn e2e` green while the failure — and the
 * observed reason — stays printed in the run's report. Each fix task DELETES
 * its entries from this map, which flips those checks to strict, so the gate
 * ratchets forward and can never silently regress.
 *
 * To prove a check really catches its defect, run it strict on demand:
 *   E2E_STRICT=palette.solid-background yarn e2e
 *   E2E_STRICT=all yarn e2e
 */
export const KNOWN_BROKEN = {};

# Paywall sequence trace — 29 September 2026

Walkthrough card 2. Each part of the paywall had been tested on its own; this
traces the whole sequence through the code — free sign-up, locked areas, swap,
checkout, webhook, pick-up, cancel, failed renewal, expiry, reminders, refund,
deletion, class licence — looking for faults at the hand-offs. Code reading
plus a probe of the pure functions; no sandbox run yet.

## Status of each finding

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Critical | `users/{uid}` create did not pin `entitlement`, and owners may delete their own doc: any signed-in account could create or recreate it with full access | **Fixed in firestore.rules (29 Sep) — needs `npm run deploy:rules`** |
| 2 | Critical | Cohort create did not refuse `licensedUntil`: anyone could create a class licensed to 2099 and join it | **Fixed in firestore.rules (29 Sep) — needs `npm run deploy:rules`** |
| 3 | High | A delayed-start ("start in 14 days") purchase reads as free until it starts: `resolveEntitlement` drops not-yet-started entries, so the pricing page times out and offers the plans again, Manage subscription is hidden during the refund window, and the "subscription ended" message can never show | **Fixed 29 Sep** — the app is handed the pending or lapsed record (`entitlementToShow`); gates still ask `effectiveTier` |
| 4 | High | After paying, the app stays locked until a reload: App reads the entitlement once per uid; the pricing page polls its own copy. Same for joining or leaving a licensed class, and renewals while the app stays open | **Fixed 29 Sep** — a refresh anywhere re-reads in every screen (`refreshEntitlementEverywhere`), also after joining/leaving a class and on returning to the app; a failed re-read keeps the last good answer |
| 5 | High | Deleting an account never cancels in Paddle; the next renewal's webhook recreates `users/{uid}` (personal data back after erasure); `deleteUser` runs last, so a "requires recent login" error lands after the entitlement is already deleted | **Mitigated 29 Sep** — deletion is refused up front while a Paddle subscription is live or pending, and a stale sign-in is caught before anything is deleted. Still open: the webhook recreates the doc with `set` (should update-only), and there is no server-side cancel |
| 6 | High/Med | One entitlement map per user: two subscriptions overwrite each other, and cancelling one revokes the other | Open |
| 7 | Med | Free area, swap counter and onboarded flag are device-local: a new device or cleared storage gives a fresh free area with unlimited swaps | Open — step 1 of docs/DESIGN-CONTENT-BEHIND-SERVER.md |
| 8 | Med | No status stored, so a cancelled subscriber is told it "renews", and would be sent a renewal reminder | Open |
| 9 | Med | Refund and chargeback events are not handled: access runs to period end | Open |
| 10 | Med | `past_due` may grant the unpaid period; `subscription.paused` is not handled; no "payment failed" message | Open — sandbox to confirm |
| 11 | Med | A class assignment in a locked area says "no questions any more"; a partly locked one runs only the free subset as a scored attempt the educator counts | Open |
| 12 | Med | Renewal reminders: the 6-month notice is off by one against the code's own comment (legal call on cadence); `.limit(200)` without paging; dry runs mark reminders sent | Open |
| 13 | Low/Med | Webhook and admin script write with `merge: true` inside the map, so stale `startsAt` and Paddle fields survive | Open |
| 14 | Low | Structure card by URL shows a locked structure's facts; onboarding saves preferred areas against the old default; history hidden after expiry; renewal lands just after `expiresAt` (suggest 48 h grace); a failed licence read makes a paid student free; month-end "next charge" date wrong; delayed-start monthly charges a full month for ~16 days; licences have no seat limit | Open |

## Tests

Tested: `entitlement.test.ts`, `checkout.test.ts`, `paddleWebhook.test.ts`
(pure functions), `renewalReminders.test.ts`, `serverOnly.test.ts`,
`accountLifecycle.test.ts`, `refunds.test.tsx`, `demoIsolation.test.ts`, and
the session gate in `generateSet.test.ts`.

Untested: **`firestore.rules` (no emulator suite — findings 1 and 2 would
have been caught by one)**, the three Netlify functions as wholes,
`useEntitlement` / `readEntitlement`, the pricing and subscription UI,
onboarding's free-area pick, and locked class assignments.

## Sandbox checklist — only what code reading cannot settle

Run against a sandbox webhook that writes to a separate Firebase project,
never production.

1. Webhook vs redirect timing after checkout (finding 4).
2. Portal cancel: event types, `status`, `scheduled_change`,
   `current_billing_period`; does `subscription.canceled` at period end carry
   `canceled_at` equal to the period end (8).
3. Failed renewal: does `current_billing_period` already point at the unpaid
   period on `past_due`; does retry end in cancel or pause (10).
4. Refund without cancelling, and a chargeback if possible (9).
5. Two subscriptions on one account, cancel one (6).
6. Delete an account with a live subscription, then simulate a renewal (5).
7. Optional: two `h1=` values in the signature header during secret rotation.

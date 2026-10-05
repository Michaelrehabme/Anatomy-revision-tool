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
| 5 | High | Deleting an account never cancels in Paddle; the next renewal's webhook recreates `users/{uid}` (personal data back after erasure); `deleteUser` runs last, so a "requires recent login" error lands after the entitlement is already deleted | **Mitigated 29 Sep** — deletion is refused up front while a Paddle subscription is live or pending, and a stale sign-in is caught before anything is deleted. The webhook no longer recreates a deleted account's doc (update-only; the event goes to `billingFailures`). Still open: no server-side cancel |
| 6 | High/Med | One entitlement map per user: two subscriptions overwrite each other, and cancelling one revokes the other | Open |
| 7 | Med | Free area, swap counter and onboarded flag are device-local: a new device or cleared storage gives a fresh free area with unlimited swaps | Open — step 1 of docs/DESIGN-CONTENT-BEHIND-SERVER.md |
| 8 | Med | No status stored, so a cancelled subscriber is told it "renews", and would be sent a renewal reminder | Open |
| 9 | Med | Refund and chargeback events are not handled: access runs to period end | **Partly fixed 5 Oct** (branch `release-next`) — see "Refunds" below. An approved full refund of a subscription's latest payment ends access; everything uncertain changes nothing and is written to `billingFailures`. **Nothing arrives until the owner ticks `adjustment.created` and `adjustment.updated` on the webhook destination in Paddle.** Chargebacks are recorded, not acted on |
| 10 | Med | `past_due` may grant the unpaid period; `subscription.paused` is not handled; no "payment failed" message | Open — sandbox to confirm |
| 11 | Med | A class assignment in a locked area says "no questions any more"; a partly locked one runs only the free subset as a scored attempt the educator counts | Open |
| 12 | Med | Renewal reminders: the 6-month notice is off by one against the code's own comment (legal call on cadence); `.limit(200)` without paging; dry runs mark reminders sent | Open |
| 13 | Low/Med | Webhook and admin script write with `merge: true` inside the map, so stale `startsAt` and Paddle fields survive | **Fixed in the webhook 29 Sep** — the map is replaced, carrying consent and customer id over; `scripts/accountData.ts` still merges |
| 14 | Low | Structure card by URL shows a locked structure's facts; onboarding saves preferred areas against the old default; history hidden after expiry; renewal lands just after `expiresAt` (suggest 48 h grace); a failed licence read makes a paid student free; month-end "next charge" date wrong; delayed-start monthly charges a full month for ~16 days; licences have no seat limit | **Structure card: Fixed 4 Oct** (`ec5cd7a`, branch `release-next`) — a locked structure's card is its region, name and the lock panel under the name; picture, facts, blood supply and drill are not rendered, on both layouts. Still the browser deciding what to draw: the facts stay in the bundle until the content-behind-the-server work lands. **The other seven: Open** |

## Refunds (finding 9) — what the webhook does, 5 October 2026

Written from Paddle's developer documentation as read that day, not from a
sandbox run:
[adjustment.created](https://developer.paddle.com/webhooks/adjustments/adjustment-created),
[adjustment.updated](https://developer.paddle.com/webhooks/adjustments/adjustment-updated),
[create adjustments](https://developer.paddle.com/build/transactions/create-transaction-adjustments),
[list transactions](https://developer.paddle.com/api-reference/transactions/list-transactions),
[respond to webhooks](https://developer.paddle.com/webhooks/respond-to-webhooks),
[signature verification](https://developer.paddle.com/webhooks/signature-verification).

A refund in Paddle is an *adjustment* against a transaction. It carries the
transaction, subscription and customer ids and **no `custom_data`**, so no
uid. Refunding does not cancel the subscription.

| Event | What happens |
|---|---|
| `adjustment.created` / `adjustment.updated`, `action: refund`, `status: approved`, `type: full`, on a subscription held by exactly one account as a Paddle entitlement, for the payment Paddle's API confirms is that subscription's latest | `expiresAt` = the event's `occurred_at`; `refundedAt` is set; a future `startsAt` is dropped. The account line reads "Your subscription was refunded and ended on …" |
| The same, but `status: pending_approval`, `rejected` or `reversed` | Nothing |
| The same, but `type: partial` | Nothing |
| `action: credit`, `credit_reverse`, `chargeback_reverse`, `chargeback_warning_reverse` | Nothing |
| `action: chargeback` or `chargeback_warning` | Nothing changed; a `billingFailures` row |
| Full approved refund of an **earlier** payment | Nothing changed; a `billingFailures` row |
| Full approved refund that cannot be confirmed as the latest payment (no `PADDLE_API_KEY`, the key may not read transactions, the transaction is not in Paddle's answer) | Nothing changed; a `billingFailures` row |
| Paddle's API unreachable, rate limited or failing | Nothing changed; a `billingFailures` row; 500, so Paddle retries |
| No account holds the subscription (deleted, or its access was replaced) | No account is created; a `billingFailures` row |
| Two accounts hold the subscription | Nothing changed; a `billingFailures` row |
| The account's access is complimentary, or a different subscription | Nothing, silently |
| Delivered twice | The second changes nothing |
| Older than the event already stored | Skipped, as for every other event |
| `PADDLE_WEBHOOK_DRY_RUN=1` | Verified and logged; no database read, no call to Paddle, no write |

Read the rows with `npx tsx scripts/accountData.ts failures`.

**What remains:**

1. **Subscribe the destination to the events.** In Paddle → Developer tools →
   Notifications, edit the webhook destination and tick `adjustment.created`
   and `adjustment.updated`, on live and on sandbox. Until then nothing
   arrives and a refund behaves as it did before.
2. **The API key must be able to read transactions** (`transaction.read`).
   The webhook uses `PADDLE_API_KEY`, the key `paddle-portal` already has. If
   it cannot, every refund lands in `billingFailures` and access stays.
3. **Cancel when you refund.** A refund leaves the subscription running. If
   it is not also cancelled it renews, charges, and grants again — correctly,
   since that renewal was paid for. Any later `subscription.updated` (a card
   change, say) also restores the period, because a subscription event
   replaces the map.
4. **Not run against the sandbox.** The list-transactions query
   (`subscription_id`, `status=completed,paid`, `order_by=billed_at[DESC]`,
   `per_page=30`) is built from the documentation. If Paddle refuses it the
   refund is recorded and access stays — the safe way to be wrong — but it
   should be seen working once before it is relied on. Sandbox checklist
   item 4.
5. **Chargebacks are not decided by code.** They are recorded for a person.
6. **Two subscriptions on one account (finding 6) still collide.** If a
   student subscribed twice and the duplicate is refunded in full, and the
   duplicate is the one the account's map holds, access ends although the
   other subscription is paid. Grant by hand, or wait for the surviving
   subscription's next event.
7. The webhook reads the last `h1` in the signature header. Paddle says more
   than one may be sent during secret rotation; rotate with care.

## Tests

Tested: `entitlement.test.ts`, `checkout.test.ts`, `paddleWebhook.test.ts`
(pure functions), `netlify/functions/__tests__/paddle-webhook.test.ts` (the
webhook as a whole against an in-memory database: refunds, duplicates,
ordering, a deleted account, the dry run — added 5 Oct), `renewalReminders.test.ts`, `serverOnly.test.ts`,
`accountLifecycle.test.ts`, `refunds.test.tsx`, `demoIsolation.test.ts`, and
the session gate in `generateSet.test.ts`.

Untested: the other two Netlify functions as wholes,
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

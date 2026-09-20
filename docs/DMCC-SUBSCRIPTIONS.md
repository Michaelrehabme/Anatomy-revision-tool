# Subscription obligations: what is built, and what is not

CR-033 item 11. The subscription rules LocusMSK has to meet, each one mapped to the thing that
meets it, so the gaps are visible rather than assumed.

## Two regimes, not one

**In force now:** the Consumer Contracts (Information, Cancellation and Additional Charges)
Regulations 2013. These require pre-contract information before the customer is bound, and give a
14-day cancellation right for digital content unless it is expressly waived.

**Coming:** the subscription contracts regime under the Digital Markets, Competition and Consumers
Act 2024. Expected to commence around spring 2027 — the date has already moved more than once, so
treat it as "before the second academic year of selling", not a fixed deadline. It adds reminder
notices, a renewal cooling-off right, and a requirement that exit be as easy as entry.

Building to the second regime now costs a few days. Retrofitting notices into a live billing system
with real subscribers costs considerably more, and the DMCC obligations carry enforcement.

## The obligations, and where each one stands

| Obligation | Status | What meets it |
|---|---|---|
| Pre-contract information before payment: price, frequency, auto-renewal, how to cancel | **Done** | The "What you are agreeing to" block on /pricing, above the pay button. The next charge date is computed, not described |
| Express consent + acknowledgement to lose the 14-day right | **Done** | `CoolingOffWaiver`, recorded per subscription with its wording version |
| The alternative to waiving: keep the right, start later | **Done** | `startsAt` on the entitlement, set 14 days out by the webhook when the waiver is declined |
| Cancellation online, one clear route, no email-us-to-cancel | **Done** | Account → Subscription → Manage subscription opens Paddle's customer portal |
| Cancelling does not cut access short | **Done** | `actionForEvent` grants to the end of the current billing period |
| Reminder before a free trial converts to a charge | **Not applicable** | There is no trial. The free region is permanent and takes no card, so nothing converts. **If a trial is ever added, this obligation switches on and must be built first** |
| Renewal reminder, annual plan | **Done — by Paddle** | UK law obliges an auto-renewal reminder for subscription periods of six months or longer, and Paddle sends those automatically to UK customers, 7 or 30 days ahead. Nothing to switch on; there is no setting for it in Paddle Billing |
| Renewal reminder, monthly plan | **Built, sending disabled** | `netlify/functions/renewal-reminders.ts`, daily at 09:00 UTC. Monthly periods fall under the six-month line, so Paddle sends nothing and these are ours. **Without `RESEND_API_KEY` the run is a dry run**: it decides and logs, and emails nobody |
| Renewal cooling-off: 14 days after an annual plan auto-renews, with a proportionate refund | **Decision needed** | /refunds currently offers a discretionary refund for an unexpected, unused renewal. Under the DMCC regime this becomes a right rather than a favour |
| Notices reliable and auditable after the fact | **Done** | Each send writes `billingReminders.<key>` on the user, checked before sending so nothing goes twice. Paddle's own sends are recorded in Paddle |

## How the reminders work

**The annual plan is Paddle's job and is already handled.** UK law requires an auto-renewal
reminder for subscription periods of six months or longer, and Paddle sends those automatically to
UK customers 7 or 30 days before renewal. There is no setting for it in Paddle Billing — the
toggle that existed in Paddle Classic is gone — and nothing for us to configure. We must not send
a second one: two emails about the same renewal is a support question, not extra compliance.

**The monthly plan is ours**, because a one-month period is under that six-month line. Paddle
sends nothing, and the DMCC cadence — before the sixth payment and before every sixth after — is
specific enough that it has to be counted rather than approximated.

There is no Paddle event to hang this on. Paddle emits nothing ahead of a renewal;
`transaction.created` appears when the renewal transaction is generated, but the lead time is
undocumented, and a legal notice cannot depend on an interval nobody has promised. Hence a
schedule.

### The parts

- `src/features/billing/lib/renewalReminders.ts` decides who is due, with no database and no
  clock. Every case it cannot work out returns "not due" with a reason, because a missing notice
  shows up in the log while a wrong one reaches a student.
- `netlify/functions/renewal-reminders.ts` runs daily at 09:00 UTC, scans Paddle subscribers, and
  sends. It writes `billingReminders.<subscription>:<payment number>` on the user, checks that
  before sending, and so cannot email the same person twice about the same renewal. That record is
  the audit trail.
- The schedule lives in `netlify.toml`. Scheduled functions only run on published production
  deploys, never on previews, so it cannot fire twice from two environments.

### Turning it on

1. Deploy as is. **With no `RESEND_API_KEY` set it is a dry run** — it works out who is due and
   logs it, and emails nobody. Watch the function log for a few weeks against real subscriptions.
2. Sign up with Resend (or another sender), verify the sending domain, and set `RESEND_API_KEY`
   and `REMINDER_FROM` in Netlify. Sending starts on the next run.
3. Test it whenever you like without waiting for the schedule: Netlify UI → Functions →
   renewal-reminders → **Run now**, or `netlify functions:invoke renewal-reminders`.

There will be nothing to send for six months after the first monthly subscriber, which is time
enough to watch the dry run behave.

## The decision that is not technical

Whether to honour the renewal cooling-off **now** or when the regime commences.

Honouring it now means: an annual subscription that auto-renews can be cancelled within 14 days of
that renewal for a refund of the unused part. Today /refunds says part-used periods are not
refunded, with a discretionary exception for an unexpected renewal nobody has used since.

Doing it now costs a small number of refunds a year and removes the sharpest edge in the policy.
Doing it later means changing the policy under a deadline, and honouring it for existing
subscribers anyway. This is the owner's call, not an engineering one.

## Evidence to keep

- The `billingReminders` records on each user — the proof a notice was sent, and what an
  enforcement query actually asks for.
- Paddle's own record of the annual reminders it sends, in its dashboard.
- The function log, which says what each run decided even when it sent nothing.
- This file, updated when any row above changes.

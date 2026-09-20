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
| Renewal reminders — annual: every six months; monthly: before the sixth payment and every sixth after | **NOT BUILT** | See below |
| Renewal cooling-off: 14 days after an annual plan auto-renews, with a proportionate refund | **Decision needed** | /refunds currently offers a discretionary refund for an unexpected, unused renewal. Under the DMCC regime this becomes a right rather than a favour |
| Notices reliable and auditable after the fact | **NOT BUILT** | Depends on the choice below |

## The gap: renewal reminders

This is the only part that cannot be done with a page. It needs something that wakes up on a
schedule, works out who is due, sends a message, and leaves a record that it did.

### Option A — Paddle's own customer emails

Paddle can send subscription emails on our behalf, which puts the sending, the deliverability and
the record inside the system that already knows the renewal dates.

- **Check first**: Paddle dashboard → Notifications → customer emails, for an upcoming-renewal
  email and what cadence it allows. If it only offers a fixed number of days before renewal, that
  covers the annual case but not "before the sixth monthly payment".
- **Cost**: minutes, plus a screenshot of the setting as evidence.
- **Risk**: the cadence is theirs, not ours, and the DMCC cadence is specific.

### Option B — a scheduled Netlify Function

A daily function reads the entitlements, finds the ones whose `expiresAt` falls in the reminder
window, sends an email, and writes a `remindersSent` record on the user so the same notice never
goes twice and an auditor can see what was sent when.

- **Needs**: an email sender (Resend, Postmark or similar — Firebase does not send arbitrary mail),
  a template, and the schedule in `netlify.toml`.
- **Cost**: a day or two, plus a few pounds a month.
- **Gain**: the cadence is ours, the log is ours, and the same mechanism later carries the
  renewal cooling-off notice.

**Recommendation: check Option A first, and build Option B anyway before the regime commences.**
A is worth having immediately whatever else happens, because a student reminded of a renewal is a
student who does not charge it back. B is what actually meets the cadence the Act sets out, and it
is much easier to build now, against a handful of subscribers, than later against a few hundred.

## The decision that is not technical

Whether to honour the renewal cooling-off **now** or when the regime commences.

Honouring it now means: an annual subscription that auto-renews can be cancelled within 14 days of
that renewal for a refund of the unused part. Today /refunds says part-used periods are not
refunded, with a discretionary exception for an unexpected renewal nobody has used since.

Doing it now costs a small number of refunds a year and removes the sharpest edge in the policy.
Doing it later means changing the policy under a deadline, and honouring it for existing
subscribers anyway. This is the owner's call, not an engineering one.

## Evidence to keep

- A screenshot of whatever Paddle customer emails are switched on, dated.
- The `remindersSent` records, once Option B exists — these are the proof a notice was sent, and
  the thing an enforcement query asks for.
- This file, updated when any row above changes.

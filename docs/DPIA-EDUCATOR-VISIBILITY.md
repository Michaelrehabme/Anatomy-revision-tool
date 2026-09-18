# DPIA — educator visibility of student revision data

**For:** a university data protection officer or information governance reviewer, and for our own accountability record under Article 35 UK GDPR.

**Assessment owner:** Michael Neary, trading as Neary's Sport Rehab.
**Version 1.0 — 18 September 2026**, against commit `fb01b58`.
**Review:** at the end of the first pilot term, or on any change to who can read what.

**Is a DPIA required here?** Probably not strictly: the processing is not large-scale special category data, not systematic monitoring of a public area, and not automated decision-making with legal effect. We have done one anyway, because "a named student's performance is visible to the person who marks their work" is the thing a university will rightly ask about, and because writing it down found two real problems (§7, R1 and R2).

---

## 1. The processing being assessed

A student creates their own account and revises. If they enter a class join code, the owner of that class — normally their module leader — can see a summary of how they are doing.

Everything else LocusMSK does is a student's own data shown to that student. This assessment covers only the disclosure to a third party, which is the whole of the additional risk.

### What flows to the educator

| Visible to the class owner | Not visible |
|---|---|
| Name | Individual answers |
| Overall accuracy | The option they picked instead |
| How recently they were active | The question-by-question record |
| Structures most often wrong | When individual answers were given |
| | Anything from before they joined the class |

### How the data physically moves

Counters are incremented **on the student's own device** as they answer, and written to `cohorts/{id}/studentStats/{uid}`. The educator reads those counters. The per-answer log never leaves the student's account: it lives at `attemptEvents`, which carries no cohort-owner permission.

This is the design decision the whole assessment rests on. Aggregating on the client, rather than shipping rows to the educator and aggregating in their browser, is what makes the promise enforceable instead of merely honoured by the interface.

---

## 2. Necessity and proportionality

**The purpose.** A module leader finds out what their group is getting wrong in time to reteach it, rather than at the exam.

**Why it needs to be per-student at all.** A purely class-wide average would be cheaper for privacy and nearly useless: it cannot distinguish "the group finds the brachial plexus hard" from "four people have not started". Identifying a student who has disengaged is a legitimate and ordinary part of teaching, and the educator already knows who is in their class.

**Why it stops where it does.** Seeing that a student is at 48% on the rotator cuff is enough to act on. Seeing that on 3 October at 23:14 they answered "teres minor" instead of "infraspinatus" is not more useful for teaching, and it is considerably more intrusive — it reveals when they study, how they think, and what they do late at night. We draw the line at the counters for that reason, not because the finer data is hard to provide.

**Alternatives considered.**

- *Anonymised student rows.* Rejected. In a class of forty, timing alone re-identifies. "Anonymised" would have been a claim we could not keep.
- *Opt-out rather than opt-in.* Rejected. A student who has not acted has not consented.
- *Educator-initiated enrolment.* Rejected. An educator can invite by email, but only the student's own device can complete the join — so the educator does the bulk work and the student still consents.

---

## 3. Lawful basis

**Consent**, Article 6(1)(a), for this disclosure specifically.

It is freely given: the app is completely usable without joining a class, and nothing is withheld from a student who does not. It is specific and informed: the join screen states what the class owner will see before the code is accepted. It is as easy to withdraw as to give: leaving a class is one action on the account screen, takes effect immediately, and stops all further visibility.

Consent is the right basis rather than legitimate interests because the student has a real choice here and should keep it, and because a university's own legitimate-interests assessment should not be something a supplier quietly assumes.

---

## 4. Consultation

Not yet consulted: no pilot cohort exists at the time of writing. This document is written *before* the first pilot precisely so that the first university sees an assessment rather than a scramble.

Planned: the first pilot's module leader and their institution's information governance contact, before any student joins. Their comments will be recorded in version 1.1.

---

## 5. Who could be affected, and how

| Risk to the individual | Likelihood | Severity |
|---|---|---|
| A student's difficulty with a topic is visible to the person marking them | Certain — it is the feature | Low; this is ordinary teaching information |
| A student feels monitored and stops using the tool honestly | Possible | Moderate; corrupts the data and the learning |
| An educator sees more than the student was told | Low after §7 R1 | High; it would make the privacy policy false |
| Data persists after a student expects it gone | Moderate — see §7 R2 | Moderate |

The second row matters more than it looks. A student who believes every wrong answer is watched will stop guessing, and guessing is how spaced repetition works. Restricting what the educator sees is therefore not only a privacy control; it protects the integrity of the thing being measured.

---

## 6. Controls already in place

| Control | Where it lives |
|---|---|
| No cohort-owner read of the per-answer log | `firestore.rules` — `attemptEvents` |
| No cohort-owner read of a student's private subcollections | `firestore.rules` — `users/{uid}/{document=**}` |
| Counters aggregated on the student's device before leaving their account | `educator/data/cohortRollups.ts` |
| Confusion statistics hold no user id and no timestamp, so nothing correlates back to a person | `cohorts/{id}/confusionStats` — counters only |
| A student can write only their own counters, not a classmate's | `firestore.rules` — `studentStats/{uid}` |
| Class membership must be proved with a join code or an addressed invitation | `firestore.rules` — `cohortIsProven()` |
| Leaving a class clears the summary immediately | `clearStudentStats()` |
| Deletion removes the educator-visible summary along with everything else | `data/accountLifecycle.ts` |
| Age confirmation at sign-up (16+) | `components/Auth/AuthScreen.tsx` |
| Access control enforced server-side, not in the client | `firestore.rules` |

---

## 7. Risks identified, and what was done

### R1 — Educators could read more than the policy promised — **CLOSED 18 September 2026**

**Found while writing this document.** The rules granted a class owner read access to every subcollection under a student's record, including session summaries. A session summary carries `missedStructureIds`, `startedAt` and `finishedAt` — what you got wrong, and when you were working, session by session.

The published privacy policy says *"not the questions you got wrong one by one, not when you answered"*, and states that this is enforced by the database's own permission rules rather than by what the app displays. **That was not true.** The grant was a leftover: change `CR-031` removed the equivalent permission from the answer log and missed this one, and nothing in the product had ever used it — every educator read is against the student's profile document, and the dashboard's figures come from the counters.

**Action taken:** the grant was removed, with the reasoning recorded in the rules file itself. The claim in the privacy policy is now backed by the rules that are supposed to back it.

**Residual risk:** low. Worth noting that only writing this assessment surfaced it, which is an argument for the assessment.

### R2 — The stated retention period is not enforced — **OPEN**

The privacy policy commits to deleting account and revision data after **24 months of inactivity**. No scheduled job does this. Deletion on request is implemented and complete; automatic expiry is not.

Nobody has yet been affected — the product is not old enough for any account to have been dormant for 24 months — so this is a gap to close before it can bite rather than a live breach. It is still a commitment made in a published policy and not kept in code, which is exactly the kind of thing a DPO should find, and we would rather find it ourselves.

**Action:** implement scheduled deletion of accounts dormant for 24 months, or amend the policy if a different period is the right one. **Owner:** Michael Neary. **Before:** the first pilot cohort completes its first term.

**Interim position:** dormant data is deleted on request, immediately, by the student.

### R3 — Counters are written by the student's own device — **ACCEPTED**

Aggregating on the client means a determined student could inflate their own class's figures. The alternative is a server-side trigger, which requires a Firebase billing plan not justified before the product has a paying user.

This is a trade-off in **integrity**, not in privacy or confidentiality: nobody gains access to anybody else's data, and rules constrain a student to writing only their own row. An educator reading a suspiciously perfect figure is a smaller problem than an educator reading everyone's answers. To be revisited when there is revenue.

### R4 — Re-identification through class-wide statistics — **MITIGATED BY DESIGN**

The confusion table is a pure counter set: correct answer, selected answer, count. No user id, no timestamp, no row per answer. There is nothing to correlate back to a person even for someone reading the raw database, which is why it survives as its own collection rather than being derived from per-student rows.

### R5 — Transfers outside the UK — **MITIGATED**

Firebase (Google Ireland Limited) and Netlify both operate documented safeguards for transfers. Stated in the privacy policy and in `DATA-PROCESSING.md` §5.

### R6 — A student consents and then forgets they have — **MITIGATED, WATCH**

Consent given once in week one governs a whole term. The account screen shows the class the student is in and the control to leave it, so the state is visible rather than buried. If pilots show students surprised by what their educator can see, the answer is a periodic reminder, not a smaller disclosure.

---

## 8. Outcome

| | |
|---|---|
| Residual risk after controls | **Low** |
| Proportionate to the purpose | Yes |
| ICO prior consultation required | No — no high residual risk remains |
| Approved to proceed to pilot | Yes, subject to R2 being closed within the term |

**Signed:** Michael Neary, 18 September 2026.

**Next review:** end of the first pilot term, on any change to educator-visible data, or on any change to `firestore.rules` affecting who may read a student's record.

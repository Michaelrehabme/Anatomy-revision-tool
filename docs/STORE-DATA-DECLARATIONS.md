# Store data declarations — Play Data Safety and Apple privacy labels

CR-025 item 8. Checked in so the declarations match the code rather than being
filled in from memory at 11pm on submission night.

**Apple cross-references what you declare against the access patterns it
detects in the binary.** An inaccurate declaration is itself a rejection under
5.1.1 — worse than a generous one, because it reads as concealment rather than
carelessness. Every row below names the file that justifies it, so a reviewer
here (or you, in a year) can check the claim rather than trust it.

Not legal advice. Have it read before an institutional contract is signed.

---

## What is actually collected

Derived from the code, not from intent.

| Data | Where it lives | Why | Code |
|---|---|---|---|
| Email address | `users/{uid}.email` | Account identity and sign-in | [firebase.ts](../src/features/anatomy-revision/data/firebase.ts) `touchUserProfile` |
| Display name | `users/{uid}.displayName` | Shown to the student, and to their class owner | same |
| User ID | `users/{uid}.uid`, on every row | Ties data to an account | same |
| Answers given | `attemptEvents` | Scheduling, progress, and the cohort counters | [types/attempt.ts](../src/features/anatomy-revision/types/attempt.ts) `UserAttempt` |
| Time taken per answer | `attemptEvents.durationMs` | Detects a structure that is known but slow | same |
| Scheduling state | `users/{uid}/mastery`, `/factMastery` | Spaced repetition intervals | [repository.ts](../src/features/anatomy-revision/data/repository.ts) |
| Session summaries | `users/{uid}/sessions` | Streaks, session length, completion | same |
| XP and streaks | `users/{uid}/gamification` | Motivation features | same |
| Class membership | `users/{uid}.cohort` | Which class owner may see a summary | [cohortsRepository.ts](../src/features/educator/data/cohortsRepository.ts) |

`attemptEvents` stores **the literal answer text a student typed or chose**
(`selectedAnswer`). It is the most sensitive field in the app. Since CR-031 no
educator can read it — only the student and an admin — and it is deleted with
the account.

## What is NOT collected

Worth stating explicitly, because these are the rows both stores expect to see
ticked and it is unusual to be able to leave them empty.

- **No advertising identifiers, no ad SDK, no ad network.**
- **No analytics SDK.** The only Firebase modules imported anywhere are
  `firebase/app`, `firebase/auth` and `firebase/firestore` — verify with
  `grep -rhoE "from 'firebase/[a-z]+'" src`. There is no `firebase/analytics`.
- **No crash or performance reporting.**
- **No location, contacts, photos, camera, microphone, health or fitness data.**
- **No purchase history** — there is no purchasing.
- **No tracking across apps or websites**, so App Tracking Transparency does
  not apply and `NSUserTrackingUsageDescription` is not needed.
- **Nothing is sold or shared for advertising.**

## Apple privacy labels

Apple's taxonomy, with the linkage and purpose each row needs.

| Apple category | Type | Linked to identity | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact Info | Email Address | Yes | No | App Functionality |
| User Content | Other User Content (answers given) | Yes | No | App Functionality |
| Identifiers | User ID | Yes | No | App Functionality |
| Usage Data | Product Interaction | Yes | No | App Functionality |

**"Linked to you" is Yes for all four, and that is correct.** Everything is
keyed by uid so a student sees their own history across devices. Declaring it
unlinked would be the inaccuracy Apple detects.

**Data Used to Track You: none.** Nothing leaves for a data broker or an ad
network, and there is no cross-app identifier.

Diagnostics is left empty: no crash reporting is integrated. Firebase records
IP addresses server-side for authentication and abuse prevention, which is
processor activity disclosed in the privacy policy rather than an app-declared
collection.

## Google Play Data Safety

| Section | Answer |
|---|---|
| Personal info → Name | Collected. Not shared. Required. App functionality, account management. |
| Personal info → Email address | Collected. Not shared. Required. App functionality, account management. |
| Personal info → User IDs | Collected. Not shared. Required. App functionality. |
| App activity → App interactions | Collected. Not shared. Required. App functionality, analytics (own). |
| App activity → Other user-generated content | Collected. Not shared. Required. App functionality. |
| Financial, Health, Location, Contacts, Photos, Files, Calendar, Messages, Audio | Not collected. |
| Data encrypted in transit | Yes — Firestore and Firebase Auth are HTTPS/TLS only. |
| Users can request data deletion | **Yes, in-app.** Account screen → Delete my account. See [accountLifecycle.ts](../src/features/anatomy-revision/data/accountLifecycle.ts). |
| Committed to Play Families policy | No — the app declares 16+ at sign-up and is not directed at children. |
| Independent security review | No. |

"Shared" is No throughout. Google Firebase is a **processor** acting on our
instructions, which Play's taxonomy counts as collection, not sharing. Saying
otherwise would overstate what happens to the data.

## Age rating

- **Apple: 17+** is unnecessary; there is no objectionable content. **12+** is
  the honest floor for a medical-education app showing anatomical imagery, but
  the operative control is the 16+ declaration at sign-up rather than the
  content rating.
- **Google Play: Everyone**, with Families policy explicitly not opted into.
- Sign-up requires confirming 16 or over before either route — Google or
  email — see [AuthScreen.tsx](../src/features/anatomy-revision/components/Auth/AuthScreen.tsx).

Under-16s in the UK bring GDPR children's provisions and Play Families with
them. Both are avoided deliberately, not by accident.

## Before submitting, re-check

These are the claims that rot. A dependency or a feature can falsify any of
them without anyone noticing.

1. `grep -rhoE "from 'firebase/[a-z]+'" src | sort -u` still lists only app,
   auth and firestore.
2. No analytics, ads or crash SDK has appeared in `package.json` dependencies.
3. Deletion still removes everything — `npm test` covers this; the erasure
   test reads the source and fails if a new subcollection is added without
   being added to the erasure walk.
4. The privacy policy URL is reachable without signing in: `/privacy`.
5. Nothing new is stored on `UserAttempt` that would change the User Content
   row.

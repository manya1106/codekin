# Product Roadmap

## MVP (weeks 1-3)

- Google sign-in in PWA and extension
- Blind mode with explicit reveal and resilient LeetCode selectors
- Accepted-submission capture, offline outbox, and idempotent sync
- Dashboard totals, streak, weekly goal, activity, and companion XP
- Installable responsive PWA with offline application shell
- Firestore rules, App Check, analytics, and deploy pipeline

## Beta (weeks 4-6)

- Canonical problem catalog and topic normalization
- Correct calendar-aware streak transaction and weekly reset
- Daily challenge scoring from weak topics and recency
- Roadmap detail pages, revision queue, and mini quizzes
- Companion mood schedule, first evolution, and cosmetic unlocks
- Local reminder UX, onboarding, error reporting, and selector telemetry

## Later

- FCM reminders through scheduled Firebase Functions
- Friends, private study circles, and opt-in leaderboards
- AI hints that reveal progressively without giving away solutions
- Solution journal, spaced repetition, and pattern flashcards
- Firefox support and optional Telegram notifications
- Additional coding platforms through isolated adapters

## Solo-developer guardrails

Keep recommendation logic deterministic until usage proves AI adds value. Ship one companion evolution path first. Treat LeetCode DOM parsing as an adapter with fixtures because selectors will change. Track Firestore reads per active user before adding more live listeners.

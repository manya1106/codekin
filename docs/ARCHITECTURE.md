# Codekin Architecture

## System shape

Codekin is a serverless TypeScript monorepo. The PWA and Chrome extension share domain types and progression formulas through `@codekin/shared`; Firebase Authentication owns identity, Firestore is the source of truth, and each client keeps an offline cache.

```text
LeetCode page -> extension content script -> chrome.storage outbox
                                             |
                                      MV3 service worker
                                             |
                                             v
React PWA <--- onSnapshot + local persistence <--- Firestore
```

The extension is local-first: an accepted submission enters `chrome.storage.local` before any network request. Its service worker uses an idempotent Firestore transaction and removes an outbox item only after commit. The PWA uses Firestore's multi-tab persistent cache; its service worker caches the application shell and static assets.

## Firestore hierarchy

```text
users/{uid}                         public profile and creation metadata
  private/progress                  aggregate counters + companion state
  problems/{leetcodeSlug}           one idempotent record per problem
  activity/{eventId}                append-only timeline and XP events
  roadmaps/{roadmapId}              per-user roadmap progress
  settings/preferences              goals, blind mode, notification choices
catalog/problems/{slug}             curated shared problem metadata (read-only)
catalog/roadmaps/{roadmapId}         curated roadmap templates (read-only)
```

`private/progress` is a compact dashboard projection. Clients listen to this single document for inexpensive instant updates, while paginated history reads come from `problems` or `activity`. A solve transaction first checks `problems/{slug}` to avoid duplicate XP, writes the solve, and updates the aggregate.

The included indexes support solved-history and activity-type queries. Firestore automatically indexes simple fields; add composite indexes only when a real query demands one. Exempt large unused map/array fields from indexing once analytics show meaningful write cost.

## Authentication

The PWA uses Firebase Google popup auth with durable browser persistence. The extension uses `chrome.identity.getAuthToken`, exchanges that token for a Firebase Google credential, and receives the same Firebase UID. Firebase authorized domains and the extension OAuth client must be configured in the Google Cloud/Firebase console.

Rules scope every user subtree to `request.auth.uid`. Production rules should additionally cap string/array sizes and restrict aggregate changes to expected deltas. For stronger anti-cheat guarantees, move XP awarding into a callable Cloud Function; the MVP intentionally avoids managed backend code.

## Real-time and offline behavior

1. A solved problem is written to the extension outbox immediately.
2. The service worker flushes now and every five minutes.
3. A transaction writes the problem and progress projection.
4. The PWA's `onSnapshot` listener receives the progress change without refresh.
5. Offline Firestore reads come from IndexedDB. When connectivity returns, the SDK synchronizes pending writes; server timestamps and transaction retries resolve contention.

Roadmaps/catalog data should be prefetched after login. The PWA application shell is available offline through Workbox. The extension never drops a queued solve when a sync attempt fails.

## Notifications

Use Firebase Cloud Messaging for the production PWA. It keeps reminders inside the product, supports web push on installed Android/desktop PWAs, and needs no separate account. iOS supports web push for home-screen PWAs, but permission UX and background delivery remain more constrained.

Telegram is simpler for scheduled server-side reminders and highly reliable delivery, but account linking, bot privacy, and context-switching make it a better optional power-user channel than the default. Both scheduled FCM and Telegram messages need trusted scheduled compute. The lowest-maintenance path is Firebase scheduled functions; without any function, use local Notifications API reminders, which are less reliable when the PWA is closed.

Recommendation: MVP local reminders, then FCM plus one small scheduled Firebase Function. Add Telegram only after users request it.

## Scalability and cost

- Listen to one aggregate document, not an entire history collection.
- Paginate history with `limit` and cursors; unsubscribe listeners when views unmount.
- Use deterministic problem IDs and transactional XP awards.
- Keep shared catalog content separate from per-user state.
- Archive or aggregate old activity events if timelines become large.
- Enable App Check before public launch and set Firebase budget alerts.
- Never put service-account credentials in either client. Firebase web config is intentionally public; rules are the security boundary.

## Deployment

Run `npm run build`, then `firebase deploy --only firestore,hosting`. Vercel is also suitable for `apps/web`, but Firebase Hosting reduces setup and keeps the stack in one console. Load `apps/extension/dist` as an unpacked extension for development; publish the same directory to the Chrome Web Store after supplying store icons and privacy disclosures.

# Codekin

An AI-ready LeetCode companion delivered as an installable React PWA and a Manifest V3 Chrome extension. It adds spoiler-free practice, offline progress capture, real-time cross-device sync, and a companion that evolves with consistent work.

## Quick start

Requirements: Node.js 20+ and a Firebase project with Google Authentication and Firestore enabled.

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
cp apps/extension/.env.example apps/extension/.env.local
npm run dev
```

Fill both environment files with the same Firebase web app configuration. Follow the complete [Firebase setup guide](docs/FIREBASE_SETUP.md) for Authentication, Firestore, Chrome OAuth, deployment, and verification. The PWA deliberately opens in a polished demo/cached state when Firebase is absent.

Build everything:

```bash
npm run typecheck
npm run build
```

Before building the extension, replace the OAuth client placeholder in `apps/extension/manifest.json`. Load `apps/extension/dist` from `chrome://extensions` with Developer mode enabled. For extension Google login, configure a Chrome Extension OAuth client in Google Cloud for the extension ID and add the OAuth client to the Firebase project's Google provider.

Deploy rules, indexes, and the PWA:

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore,hosting
```

## Workspace

```text
apps/web          React + Vite + Tailwind + Framer Motion PWA
apps/extension    React popup + MV3 worker + LeetCode content script
packages/shared   Types, XP curve, and companion evolution rules
docs              Architecture, operations, and product roadmap
```

Read [the Firebase setup guide](docs/FIREBASE_SETUP.md) first. [The architecture](docs/ARCHITECTURE.md) covers the schema, auth flow, sync model, notification recommendation, scalability notes, and deployment details. See [the roadmap](docs/ROADMAP.md) for MVP and future phases.

## Important MVP boundaries

LeetCode does not expose a stable public browser API for submission events. The extension observes page state, so its selectors and text fixtures should be tested whenever LeetCode ships a UI update. Streak calculation and weekly resets are intentionally listed for beta hardening; production anti-cheat should award XP in a small Firebase Function.

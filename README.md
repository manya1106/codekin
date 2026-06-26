🦊 Codekin
Your AI-Ready LeetCode Companion

Codekin is an installable React Progressive Web App (PWA) and a Manifest V3 Chrome Extension designed to supercharge your LeetCode grind. It goes beyond simple tracking by adding spoiler-free practice, offline progress capture, real-time cross-device sync, and an interactive companion that evolves as you consistently put in the work.

✨ Key Features
Companion Evolution: Stay motivated with a virtual companion that levels up and evolves based on your problem-solving consistency and XP gain.

Spoiler-Free Practice: Hides optimal solutions, related tags, and acceptance rates until you are ready to see them, preventing accidental hints.

Real-Time Sync: Seamlessly sync your progress across your browser extension and mobile/desktop PWA using Firebase.

Offline Support: Your progress is captured even if you lose your connection, syncing automatically once you're back online.

AI-Ready: Built from the ground up to integrate AI-driven hints and learning paths (see Roadmap below).

🏗️ Workspace Architecture
This project is structured as a monorepo containing both the web app and the browser extension:

Plaintext
apps/web           # React + Vite + Tailwind + Framer Motion PWA
apps/extension     # React popup + MV3 worker + LeetCode content script
packages/shared    # Types, XP curve logic, and companion evolution rules
docs               # Architecture, operations, and product roadmap
Note: Please read the Architecture Guide for deep dives into our database schema, auth flow, sync model, notification recommendations, and scalability notes.

🚀 Quick Start
1. Prerequisites
Node.js: Version 20+

Firebase: A Firebase project with Google Authentication and Firestore enabled. (See the Firebase Setup Guide for detailed steps).

2. Installation
Clone the repository and install dependencies:

Bash
npm install
Set up your environment variables by copying the example files:

Bash
cp apps/web/.env.example apps/web/.env.local
cp apps/extension/.env.example apps/extension/.env.local
Make sure to fill both .env.local files with the same Firebase web app configuration. Without valid Firebase credentials, the PWA will default to an empty state.

Start the development server:

Bash
npm run dev
3. Building the Project
To check types and build both the extension and web app:

Bash
npm run typecheck
npm run build
4. Extension Setup (Local Testing)
Before building the extension, replace the OAuth client placeholder in apps/extension/manifest.json.

Go to chrome://extensions in your browser.

Enable Developer mode (top right).

Click Load unpacked and select the apps/extension/dist directory.

For Google Login: Configure a Chrome Extension OAuth client in Google Cloud for your extension ID, and add this client to your Firebase project's Google provider. (See the Extension Setup Guide).

5. Deployment
Deploy your Firebase rules, Firestore indexes, and host the PWA:

Bash
npm install -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore,hosting
⚠️ Important MVP Boundaries & Technical Caveats
DOM Observation: LeetCode does not expose a stable public browser API for submission events. Codekin relies on observing page state (DOM changes). Extension selectors and text fixtures must be tested whenever LeetCode ships a UI update.

Anti-Cheat & XP: Streak calculation and weekly resets are currently in the frontend for beta hardening. For production, anti-cheat measures will be implemented, and XP will be securely awarded via a Firebase Cloud Function.

🔮 Future Features (What's Next?)
Codekin is actively evolving. Here is a look at what is currently being worked on and planned for future releases to make this the ultimate LeetCode companion:

🛠️ Currently Working On
AI-Powered "Nudges": Instead of giving away the answer, Codekin will read your current code and use an LLM to give you a localized, conceptual hint to get you unstuck.

Spaced Repetition System (SRS): An algorithm that tracks which problems took you the longest to solve and automatically reminds you to re-do them right before you are likely to forget the pattern.

🌟 Planned for the Future
Analytics Dashboard: A deep dive into your strengths and weaknesses (e.g., "You excel at Two-Pointers, but struggle with Dynamic Programming") visualized through intuitive charts.

Companion Customization: Unlockable themes, skins, and specific companion types (e.g., a "Strict Coach" vs. a "Cheerleader") based on your LeetCode streaks.

Social Leaderboards: Opt-in leaderboards to compete with friends or study groups on weekly XP generation.

Time-Complexity Analyzer: On-the-fly estimation of your code's Big-O time and space complexity before you hit submit.

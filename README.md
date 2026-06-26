# 🦊 Codekin
**Your AI-Ready LeetCode Companion**

Codekin is an installable React PWA and Manifest V3 Chrome Extension that transforms your LeetCode practice into a structured learning experience. Beyond simple progress tracking, it provides AI-driven guidance, spaced repetition learning, and real-time performance analytics to accelerate your growth as a problem solver.

## ✨ Core Features

**Spoiler-Free Learning Environment**
Prevents accidental hints by hiding optimal solutions, related tags, and acceptance rates until you're ready to see them.

**Real-Time Progress Sync**
Seamlessly sync your practice data across browser extension, mobile, and desktop using Firebase. Your learning journey stays in sync, everywhere.

**Offline-First Learning**
Continue your practice offline. Progress is automatically captured and synced when you're back online—no learning gaps.

**Motivation Through Progression**
Track consistency with streaks and visual progression metrics that keep you engaged without sacrificing substance.

---

## 🏗️ Project Architecture

This is a monorepo containing integrated tools for distributed learning:

```
apps/web           # React + Vite + Tailwind PWA
apps/extension     # React popup + MV3 worker + LeetCode content script  
packages/shared    # Core types, XP logic, progression systems
docs               # Architecture guides, schemas, operations
```

📖 **[See the Architecture Guide](docs/)** for database schema, auth flow, sync model, and scalability details.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: 20+
- **Firebase**: Project with Google Authentication and Firestore enabled ([Setup Guide](docs/firebase-setup.md))

### Installation

```bash
# Clone and install dependencies
npm install

# Configure environment variables
cp apps/web/.env.example apps/web/.env.local
cp apps/extension/.env.example apps/extension/.env.local
# Fill both .env.local files with your Firebase credentials
```

### Development

```bash
# Start dev server
npm run dev

# Type-check and build
npm run typecheck
npm run build
```

### Extension Setup (Local)

1. In `apps/extension/manifest.json`, replace the OAuth client placeholder
2. Open `chrome://extensions` → Enable **Developer mode**
3. Click **Load unpacked** → Select `apps/extension/dist`
4. Configure a Chrome Extension OAuth client in Google Cloud Console and add it to your Firebase project

### Deployment

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore,hosting
```

---

## ⚠️ MVP Boundaries & Technical Notes

**DOM-Based Observation**: LeetCode doesn't expose a stable public API for submission events. Codekin observes DOM changes—selectors and fixtures need regular testing against LeetCode updates.

**Frontend XP (Beta)**: Streak calculation and weekly resets run client-side for beta validation. Production will move to backend with anti-cheat validation and secure XP awarding.

---

## 🔮 Roadmap: Features That Accelerate Your Growth

### 🛠️ Currently Building

**AI-Powered Conceptual Nudges**  
Stuck on a problem? Codekin analyzes your current code and provides targeted, conceptual hints—not solutions. Learn to think, not to copy.

**Spaced Repetition Learning System**  
An intelligent algorithm identifies problems you struggled with and surfaces them at optimal intervals before you'd forget the pattern. Studies show this multiplies retention by 3-5x.

---

### 🌟 Planned Features

**Personalized Performance Analytics**  
Discover your algorithmic strengths and weaknesses with automated analysis:
- Topic-by-topic success rates (Two-Pointers, DP, Graphs, etc.)
- Time-to-solve trends and improvement trajectories
- Pattern recognition across similar problem types
- Data-driven study recommendations

**Difficulty Calibration & Progressive Challenges**  
Smart problem selection that adapts to your current level:
- Automatic identification of your optimal challenge level
- Graduated problem sequences within each topic
- Early detection of knowledge gaps before they compound

**Code Quality Insights**  
Real-time feedback on algorithmic performance:
- Big-O time and space complexity estimation before submission
- Performance bottleneck identification
- Comparison with optimal solutions (after solving)
- Best practice pattern suggestions

**Weakness-Focused Practice Mode**  
Targeted remediation system:
- Automatically generates practice sets for your weaker topics
- Tracks improvement velocity on previously difficult patterns
- Confidence scoring across algorithm categories

**Community Problem Analysis** *(Opt-in)*  
Learn from aggregated data:
- Most commonly failed problem patterns in the community
- Emerging techniques for recently difficult problems
- Performance benchmarks within your experience level

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion
- **Backend**: Firebase (Firestore, Cloud Functions, Authentication)
- **Extension**: Manifest V3, Content Scripts, Service Workers
- **Languages**: TypeScript (57%), JavaScript (42%), HTML (1%)

---

**Built with 🦊 to make LeetCode grind smarter, not harder.**

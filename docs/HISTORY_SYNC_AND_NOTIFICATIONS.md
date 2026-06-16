# LeetCode History Sync & Push Notifications Guide

## Overview

This guide covers:
1. How LeetCode history is scraped and synced to your database
2. Alternative approaches using push notifications for better tracking
3. Firestore collection setup for storing history data
4. How to manually re-sync your complete history

---

## History Scraping - How It Works

### Current Implementation

**Event Trigger:** History is fetched when you click **Connect Google account** and again when you click **Sync history** in the extension popup. Accepted solves also queue locally and the service worker flushes them to Firestore every 5 minutes and on demand.

**What gets synced:**
- All accepted LeetCode submissions (limit: 200 most recent)
- Problem slug, title, timestamp, and difficulty (inferred)
- Automatically merged with any new problems you solve after connecting

### Manual Re-Sync Instructions

Since v1.1+, you can re-sync your entire history manually:

1. **Open extension popup** → Click **Sync history** after connecting.
2. **Via manual reset:** Clear browser storage:
   ```javascript
   // Run in extension console
   chrome.storage.local.remove(['lastHistorySync', 'forceHistorySync']);
   // Then click "Sync history" in the popup
   ```

### Technical Details

**Endpoint:** `https://leetcode.com/graphql`

**GraphQL Query:**
```graphql
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id
    title
    titleSlug
    timestamp
  }
}
```

**Rate Limiting:**
- Syncs once per 24 hours automatically
- Manual re-sync allowed at any time
- Limit: 200 most recent problems (LeetCode API standard)

### Current Tracking Limit

**Default Limit:** 200 problems
**Why:** LeetCode GraphQL API typically caps at 200-500 submissions per request; 200 is reliable across regions.

**To increase beyond 200:**
You would need a backend service that:
1. Stores your LeetCode credentials or OAuth token
2. Makes paginated requests to LeetCode API
3. Persists problems as they're fetched

---

## Alternative: Push Notifications for Real-Time Tracking

### Why Use Push Notifications?

Instead of polling/scraping, use FCM (Firebase Cloud Messaging) to:
- **Real-time sync:** Track problems as you solve them on LeetCode
- **Webhook triggers:** Backend monitors your LeetCode profile and sends push notifications
- **Better tracking:** No client-side scraping limitations

### Implementation Steps

#### 1. **Enable FCM in the Web App**

Already partially implemented in [apps/web/src/firebase.ts](../apps/web/src/firebase.ts):

```typescript
export async function requestNotificationPermission() {
  if (!messaging || !auth?.currentUser || !db) {
    alert("Please sign in and ensure Firebase is connected first.");
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });
      if (token) {
        await setDoc(
          doc(db, "users", auth.currentUser.uid, "settings", "preferences"),
          { fcmToken: token },
          { merge: true }
        );
      }
    }
  } catch (err) {
    console.error("FCM Token request failed", err);
  }
}
```

**Next step:** Call this function on app startup for connected users.

#### 2. **Create a Backend Service (Cloud Function)**

Deploy a Cloud Function to monitor LeetCode and send FCM messages:

```typescript
// functions/src/index.ts (Firebase Cloud Function)
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();
const db = admin.firestore();

// Trigger daily or on-demand to check for new submissions
export const syncLeetCodeHistory = functions.https.onRequest(
  async (req, res) => {
    const users = await db.collection("users").listDocuments();
    
    for (const userDoc of users) {
      const userRef = userDoc.ref;
      const lastSync = (await userRef.get()).data()?.lastSync || 0;
      
      // Query LeetCode GraphQL endpoint
      const response = await axios.post("https://leetcode.com/graphql", {
        query: `{ userStatus { username } }`
      });
      
      const username = response.data?.data?.userStatus?.username;
      if (!username) continue;
      
      // Fetch recent submissions
      const submissionsRes = await axios.post("https://leetcode.com/graphql", {
        query: `query recentAcSubmissions($username: String!, $limit: Int!) {
          recentAcSubmissionList(username: $username, limit: $limit) {
            id title titleSlug timestamp
          }
        }`,
        variables: { username, limit: 200 }
      });
      
      const submissions = submissionsRes.data?.data?.recentAcSubmissionList || [];
      
      // For each new submission, send FCM notification
      for (const sub of submissions) {
        const timestamp = parseInt(sub.timestamp) * 1000;
        if (timestamp > lastSync) {
          // Get FCM token
          const fcmToken = (
            await userRef.collection("settings").doc("preferences").get()
          ).data()?.fcmToken;
          
          if (fcmToken) {
            await admin.messaging().sendToDevice(fcmToken, {
              notification: {
                title: `🎯 Problem Solved!`,
                body: `${sub.title} (${sub.titleSlug})`,
              },
              data: {
                slug: sub.titleSlug,
                type: "problemSolved",
              },
            });
          }
          
          // Add to problems collection
          await userRef
            .collection("problems")
            .doc(sub.titleSlug)
            .set(
              {
                slug: sub.titleSlug,
                title: sub.title,
                solvedAt: new Date(timestamp),
                source: "webhook",
              },
              { merge: true }
            );
        }
      }
      
      // Update last sync time
      await userRef.update({ lastSync: Date.now() });
    }
    
    res.send("Sync complete");
  }
);

// Schedule to run every hour
export const scheduledLeetCodeSync = functions.pubsub
  .schedule("every 1 hours")
  .onRun(async () => {
    const response = await axios.post(
      `https://${process.env.GOOGLE_CLOUD_PROJECT}.cloudfunctions.net/syncLeetCodeHistory`,
      {}
    );
    console.log(response.data);
  });
```

#### 3. **Enable Web Push Notifications in Extension**

In [apps/extension/src/background.ts](../apps/extension/src/background.ts):

```typescript
// Listen for FCM messages in background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SYNC_FROM_FCM") {
    // Received push notification with new problem data
    chrome.storage.local.get("outbox", (data) => {
      const queue = data.outbox || [];
      queue.push(message.problem);
      chrome.storage.local.set({ outbox: queue });
      flush();
    });
  }
});
```

### Pros & Cons

| Approach | Pros | Cons |
|----------|------|------|
| **Client-Side Scraping** (Current) | Works immediately; no backend needed | Limited to 200 recent; occasional API rate limits |
| **Push Notifications** (Recommended) | Real-time; tracks all submissions; scales well | Requires Cloud Function backend; Firebase Blaze plan |

---

## Firestore Collection Structure

### Do I Need to Create Collections Manually?

**No.** Firestore creates collections automatically when you write your first document.

### Collection Structure for History

```
firestore
├── users/
│   └── {uid}/ (auto-created on first login)
│       ├── problems/ (auto-created on first sync)
│       │   └── {slug}/ (e.g., "two-sum")
│       │       ├── slug: "two-sum"
│       │       ├── title: "Two Sum"
│       │       ├── difficulty: "Easy"
│       │       ├── topics: ["Array", "Hash Table"]
│       │       ├── status: "solved"
│       │       ├── solvedAt: "2024-06-15T10:30:00Z"
│       │       ├── source: "extension" or "webhook"
│       │       └── syncedAt: (server timestamp)
│       │
│       ├── private/
│       │   └── progress/ (auto-created on first sync)
│       │       ├── totalSolved: 42
│       │       ├── currentStreak: 7
│       │       ├── longestStreak: 14
│       │       ├── weeklySolved: 3
│       │       ├── weeklyGoal: 7
│       │       ├── lastSolvedAt: "2024-06-15T10:30:00Z"
│       │       ├── updatedAt: (server timestamp)
│       │       └── companion: {...}
│       │
│       └── settings/
│           └── preferences/ (auto-created on FCM setup)
│               ├── fcmToken: "ABC123..."
│               ├── blindMode: true
│               └── updatedAt: (server timestamp)
```

### How Collections Are Created

The extension writes to Firestore in [apps/extension/src/background.ts](../apps/extension/src/background.ts) using batched commits:

```typescript
const problemRef = doc(db, "users", uid, "problems", problem.slug);
const progressRef = doc(db, "users", uid, "private", "progress");

const batch = writeBatch(db);
batch.set(problemRef, { ...problem, syncedAt: serverTimestamp() }, { merge: true });
batch.set(progressRef, { /* progress data */ }, { merge: true });
await batch.commit();
```

Collections are created automatically on the first successful write; no manual collection creation is required.

### Enable Firestore Offline Mode (Optional)

To allow history viewing without internet:

In [apps/web/src/firebase.ts](../apps/web/src/firebase.ts):

```typescript
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

export const db = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(), // ✅ Already enabled
      }),
    })
  : null;
```

---

## Usage Instructions

### 1. **Initial Setup**

```
Extension Popup → "Connect Google account"
↓
Background script fetches last 200 LeetCode submissions
↓
Added to "pending sync" queue
↓
Auto-syncs to Firestore
↓
Data appears in Dashboard
```

### 2. **Manual Re-Sync History**

```
Extension Popup → "Sync history" button
↓
Fetches the recent accepted submissions again
↓
Checks against already-synced problems
↓
Adds only new problems to queue
↓
Syncs to Firestore
```

### 3. **Daily Automatic Sync**

Every 5 minutes, the extension:
- Syncs pending solves in the queue
- Runs a daily history check (if 24 hours have passed)

See [apps/extension/src/background.ts](../apps/extension/src/background.ts):
```typescript
chrome.alarms.create("sync-outbox", { periodInMinutes: 5 });
```

### 4. **Enable Push Notifications (Future)**

```
Dashboard → Settings → "Enable notifications"
↓
Browser requests permission
↓
Stores FCM token in Firestore
↓
Cloud Function backend sends notifications on new solves
```

---

## Troubleshooting

### History not syncing?

1. **Check Chrome DevTools → Application → Local Storage:**
   - Look for `outbox` (pending syncs)
   - Look for `lastHistorySync` timestamp

2. **Verify Firebase connection:**
   - Popup should show "Connected as [Your Name]"
   - Firestore should have `users/{uid}/` collection

3. **Check browser console for errors:**
   ```javascript
   chrome.runtime.sendMessage({type:"GET_STATUS"}, console.log);
   ```

4. **Force re-sync:**
   ```javascript
   chrome.storage.local.set({forceHistorySync: true});
   chrome.runtime.sendMessage({type:"SYNC_HISTORY"}, console.log);
   ```

### FCM Token not saving?

1. Ensure you're logged in (red dot → green dot in App)
2. Browser must support Web Push Notifications (all modern browsers)
3. Check Firestore `users/{uid}/settings/preferences` for `fcmToken` field

### Difficulty showing as "Medium" for all problems?

LeetCode GraphQL API doesn't return difficulty directly in recent submissions. Current code infers it from page content. To improve:

1. Use the `problemDetail` query (requires extra API calls per problem)
2. Wait for problems to be solved through extension (automatically infers from page)
3. Enable the backend webhook to fetch full problem data

---

## Next Steps

1. ✅ **Test re-sync button** in extension popup
2. ⚠️ **Deploy Cloud Function** for push notifications (optional, premium feature)
3. ⚠️ **Increase limit to 500+** (requires backend pagination)
4. ⚠️ **Fetch difficulty data** from LeetCode problem detail pages

---

## Reference Files

- [Extension Background Script](../apps/extension/src/background.ts) - History scraping & sync logic
- [Extension Popup](../apps/extension/src/popup.tsx) - Manual re-sync button
- [Firebase Setup](../apps/web/src/firebase.ts) - FCM & Firestore initialization
- [Architecture Docs](./ARCHITECTURE.md) - Schema & design decisions

# Chrome Extension Setup

The extension tracks accepted submissions made after installation and setup. It does not automatically import your historical LeetCode account, so Codekin's total means **problems synchronized by Codekin**, not LeetCode's lifetime solved total.

## Setup

1. Complete [Firebase setup](FIREBASE_SETUP.md), including `apps/extension/.env.local`.
2. Build the extension:

   ```bash
   npm run build -w @codekin/extension
   ```

3. Open `chrome://extensions`, enable Developer mode, and click **Load unpacked**.
4. Select `apps/extension/dist` and copy the extension ID.
5. In the Firebase project's Google Cloud Console, create an OAuth client with application type **Chrome Extension**. Use that extension ID as its Item ID.
6. Replace `REPLACE_WITH_CHROME_OAUTH_CLIENT_ID` in `apps/extension/manifest.json` with the generated OAuth client ID.
7. Add this under **Firebase Authentication > Settings > Authorized domains**:

   ```text
   chrome-extension://YOUR_EXTENSION_ID
   ```

8. Build again and reload Codekin from `chrome://extensions`.
9. Open the popup and click **Connect Google account**. Use the same Google account as the PWA.

## Synchronization flow

1. Clicking Run or Submit reveals blind-mode fields.
2. When a submitted result changes to Accepted, the extension records the problem.
3. The record enters `chrome.storage.local` first, so it survives offline use.
4. The service worker writes it to Firestore when authenticated and online.
5. The PWA receives the Firestore update without a refresh.

The problem slug is its Firestore document ID, so accepting the same problem again does not award XP twice.

## Not imported yet

- Solutions accepted before extension setup
- LeetCode's lifetime solved total
- Historical submission dates, topics, and difficulty breakdown
- LeetCode streak and calendar history

These require a separate history-import workflow. LeetCode does not provide a stable official public synchronization API for this use case, so historical data should not be silently mixed with extension-observed solves.

## Verify it

1. The popup says **Connected as ...** rather than reporting missing OAuth or Firebase settings.
2. Submit a new accepted LeetCode solution.
3. The popup returns to `0 pending sync`.
4. Firestore contains `users/{uid}/problems/{slug}` and `users/{uid}/private/progress`.
5. The PWA lists the problem under **Recent activity**.


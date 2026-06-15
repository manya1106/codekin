# Firebase Setup for Codekin

This guide configures one Firebase project for both clients:

- `apps/web`: React PWA using Firebase Google Sign-In and Firestore
- `apps/extension`: Chrome extension using `chrome.identity`, then exchanging the Google token for a Firebase credential

The Firebase web configuration is not a server secret. It identifies the project; Firestore Security Rules protect the data. Never add service-account JSON or private keys to either client.

## 1. Create the Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) and select **Create a project**.
2. Use a name such as `Codekin`.
3. Check the generated **Project ID** carefully. It becomes part of URLs and cannot be changed later.
4. Google Analytics is optional for this MVP. You can leave it disabled and enable it later.
5. Create the project and wait for provisioning to finish.

The free Spark plan is enough for initial development of Authentication, Firestore, and Hosting. Scheduled Cloud Functions or some future notification features may require the Blaze plan.

## 2. Register the web app

1. From **Project Overview**, click the web `</>` icon.
2. Set the nickname to `Codekin Web`.
3. You may enable Firebase Hosting during this screen, but it is not required because this repository already contains `firebase.json`.
4. Click **Register app**.
5. Copy the displayed `firebaseConfig` object. It looks like:

```ts
const firebaseConfig = {
  apiKey: "...",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "...",
  appId: "...",
};
```

You can retrieve it later from **Project settings > General > Your apps > Codekin Web > SDK setup and configuration**.

## 3. Add local environment files

From the repository root:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/extension/.env.example apps/extension/.env.local
```

Fill `apps/web/.env.local` from the Firebase config:

```dotenv
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT_ID.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Fill `apps/extension/.env.local` with the corresponding values:

```dotenv
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_APP_ID=your_app_id
```

Do not wrap values in quotes. Both `.env.local` files are ignored by Git. Restart the Vite development process after changing them because Vite reads environment values at startup.

## 4. Enable Google Authentication

1. In Firebase Console, open **Build > Authentication**.
2. Click **Get started** if Authentication has not been initialized.
3. Open **Sign-in method**.
4. Select **Google** and enable it.
5. Select a **Project support email**.
6. Save.

Then open **Authentication > Settings > Authorized domains**:

- Add `localhost` for local PWA development if it is not already present.
- Firebase Hosting domains such as `YOUR_PROJECT_ID.web.app` and `YOUR_PROJECT_ID.firebaseapp.com` are normally added automatically.
- Add a custom production domain here later if you connect one.

Do not enter `http://localhost:5173`; Firebase expects the domain only: `localhost`.

## 5. Create Firestore

1. Open **Build > Firestore Database**.
2. Click **Create database**.
3. Choose **Standard edition** and the default database ID `(default)`.
4. Select **Production mode**. The repository will deploy its own authenticated-user rules.
5. Choose the location carefully because the default database location cannot be changed later.

For primarily Indian users, `asia-south1` (Mumbai) is a sensible low-latency choice. Choose a region near the majority of your expected users and any future Cloud Functions.

Do not manually create collections. Codekin creates user documents after authenticated activity is synchronized.

## 6. Connect the Firebase CLI

Install and authenticate the CLI:

```bash
npm install -g firebase-tools
firebase login
firebase projects:list
```

From this repository root, associate the local project:

```bash
firebase use --add
```

Select the Firebase project created above and use the alias `default`. This creates `.firebaserc`, which should resemble:

```json
{
  "projects": {
    "default": "YOUR_PROJECT_ID"
  }
}
```

Do not run `firebase init` with default answers. This repository already has the required `firebase.json`, `firestore.rules`, and `firestore.indexes.json` files.

Deploy Firestore rules and indexes:

```bash
firebase deploy --only firestore
```

The deployed rules ensure a signed-in user can access only `users/{theirUid}/...`. The shared `catalog` is readable by authenticated users and not writable from either client.

## 7. Verify the PWA

Start the web app:

```bash
npm run dev:web
```

Open the URL printed by Vite, normally `http://localhost:5173`.

1. The sidebar button should say **Continue with Google**, not **Configure Firebase**.
2. Sign in with Google.
3. Confirm your name appears in the lower-left account card.
4. In Firebase Console, open **Authentication > Users** and confirm the user exists.

The dashboard can still show seeded demo statistics until the extension writes the first real progress document. That is expected.

Common PWA auth errors:

- `auth/unauthorized-domain`: add `localhost` or the deployed domain under Authentication authorized domains.
- `auth/popup-blocked`: allow popups for the local or hosted site and click the button again.
- The button still says **Configure Firebase**: check the `.env.local` names and restart Vite.

## 8. Configure Chrome extension OAuth

The extension needs a second credential: a Google OAuth client whose application type is **Chrome Extension**. Create it in the same underlying Google Cloud project as Firebase.

### 8.1 Build and load the extension once

```bash
npm run build -w @codekin/extension
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `apps/extension/dist`.
5. Copy the extension's 32-character **ID** from its card.

Keep loading the same `apps/extension/dist` path in the same Chrome profile during development so the ID remains stable. A Chrome Web Store release will have its own permanent item ID; create or update the production OAuth client for that ID before publishing.

### 8.2 Configure Google Auth Platform

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select the exact project used by Firebase.
2. Open **Google Auth Platform**.
3. Complete **Branding** with the app name `Codekin`, support email, and developer contact email.
4. Under **Audience**, choose the appropriate audience. For a personal test project, use External and add your Google account as a test user if prompted.
5. The extension requests only `openid`, `email`, and `profile`; do not add unrelated sensitive scopes.

### 8.3 Create the Chrome Extension OAuth client

1. Open **Google Auth Platform > Clients**.
2. Click **Create client**.
3. Select **Chrome Extension** as the application type.
4. Name it `Codekin Chrome Extension`.
5. Paste the extension ID into **Item ID**.
6. Create the client and copy the client ID ending in `.apps.googleusercontent.com`.

Replace the placeholder in `apps/extension/manifest.json`:

```json
"oauth2": {
  "client_id": "YOUR_CHROME_CLIENT_ID.apps.googleusercontent.com",
  "scopes": ["openid", "email", "profile"]
}
```

Also add the extension origin under **Firebase Console > Authentication > Settings > Authorized domains**:

```text
chrome-extension://YOUR_EXTENSION_ID
```

Rebuild and reload the extension:

```bash
npm run build -w @codekin/extension
```

Return to `chrome://extensions` and click the reload icon on Codekin.

### 8.4 Verify extension authentication

1. Open the Codekin extension popup.
2. Click **Connect Google account**.
3. Complete the Chrome account consent prompt.
4. The popup should change to `Hi, <first name>!`.

If OAuth reports a client or item-ID mismatch, compare the current `chrome://extensions` ID with the **Item ID** configured for the OAuth client and ensure the rebuilt manifest contains the correct client ID.

## 9. Verify Firestore synchronization

1. Keep the PWA signed in with the same Google account used by the extension.
2. Open a LeetCode problem and submit an accepted solution.
3. Open the extension popup. Its pending-sync count should return to `0` when online.
4. In Firestore, verify these paths exist:

```text
users/{firebaseUid}/problems/{leetcodeSlug}
users/{firebaseUid}/private/progress
```

5. The PWA's progress listener should update without a manual refresh.

If the queue remains pending, inspect the extension service worker from `chrome://extensions > Codekin > Service worker`. Typical causes are different Google accounts, undeployed Firestore rules, an incorrect Firebase project ID, or an OAuth client tied to another Google Cloud project.

## 10. Deploy the PWA

Build and deploy Hosting, Firestore rules, and indexes:

```bash
npm run build
firebase deploy --only hosting,firestore
```

Firebase will publish the PWA at:

```text
https://YOUR_PROJECT_ID.web.app
https://YOUR_PROJECT_ID.firebaseapp.com
```

After deployment, test Google login from the hosted URL. If you later connect a custom domain, add it to **Authentication > Settings > Authorized domains**.

## 11. Recommended pre-launch settings

- Set Google Cloud budget alerts even when starting on the free plan.
- Review **Firestore > Rules** after deployment and confirm the console matches `firestore.rules`.
- Enable Firebase App Check for the PWA before a public launch. Test it in monitoring mode before enforcing it.
- Do not enable App Check enforcement for Firestore until both the PWA and extension have a supported token strategy; otherwise extension sync can be blocked.
- Create separate Firebase projects for development and production before real users arrive.
- Never commit `.env.local`, service-account files, OAuth client secrets, or downloaded credential JSON.

## Setup checklist

- [ ] Firebase project created
- [ ] Web app registered
- [ ] Both `.env.local` files populated
- [ ] Google Authentication enabled
- [ ] `localhost` authorized
- [ ] Firestore created in Production mode
- [ ] `firebase use --add` completed
- [ ] Firestore rules and indexes deployed
- [ ] PWA Google login verified
- [ ] Extension loaded and ID copied
- [ ] Chrome Extension OAuth client created in the same project
- [ ] Manifest OAuth client ID replaced
- [ ] Extension origin authorized in Firebase
- [ ] Extension Google login verified
- [ ] Accepted LeetCode submission synchronized
- [ ] PWA deployed and hosted login verified


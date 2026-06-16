import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc } from "firebase/firestore";
import { getMessaging, getToken, onMessage, type MessagePayload } from "firebase/messaging";

// ── Config ─────────────────────────────────────────────────────────────────────
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);
const app = firebaseConfigured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app
  ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  : null;

// ── Messaging: conditional init ────────────────────────────────────────────────
const messagingSupported = Boolean(config.messagingSenderId && app && typeof navigator !== "undefined" && "serviceWorker" in navigator);
let messaging: ReturnType<typeof getMessaging> | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

// Foreground message callback
type ForegroundHandler = (payload: MessagePayload) => void;
let foregroundHandler: ForegroundHandler | null = null;

export function onForegroundMessage(handler: ForegroundHandler) {
  foregroundHandler = handler;
}

async function initMessaging() {
  if (!messagingSupported || !app || messaging) return;
  try {
    messaging = getMessaging(app);

    // Register the SW and send it the Firebase config
    swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;
    swRegistration.active?.postMessage({
      type: "FIREBASE_CONFIG",
      config: {
        apiKey: config.apiKey,
        projectId: config.projectId,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      },
    });

    // Listen for foreground messages
    onMessage(messaging, (payload) => {
      if (foregroundHandler) foregroundHandler(payload);
    });
  } catch (err) {
    console.error("FCM init failed:", err);
    messaging = null;
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────────
export async function loginWithGoogle() {
  if (!auth) return;
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function logout() {
  if (auth) await signOut(auth);
}

// ── Notification permission ────────────────────────────────────────────────────
export interface NotificationResult {
  status: "granted" | "denied" | "error" | "unsupported";
  message: string;
}

export async function requestNotificationPermission(): Promise<NotificationResult> {
  if (!messagingSupported) {
    return { status: "unsupported", message: "Push notifications are not supported in this browser or messagingSenderId is not configured." };
  }
  if (!auth?.currentUser || !db) {
    return { status: "error", message: "Please sign in first." };
  }

  try {
    await initMessaging();
    if (!messaging || !swRegistration) {
      return { status: "error", message: "Could not initialize messaging service." };
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { status: "denied", message: "Permission denied. You can enable notifications in your browser settings." };
    }

    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined,
    });

    if (token) {
      await setDoc(
        doc(db, "users", auth.currentUser.uid, "settings", "preferences"),
        { fcmToken: token },
        { merge: true },
      );
      return { status: "granted", message: "Push notifications enabled! You'll receive reminders here." };
    }

    return { status: "error", message: "Could not generate a notification token." };
  } catch (err) {
    console.error("FCM permission error:", err);
    return { status: "error", message: `Failed: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const firebaseConfigured = Boolean(config.apiKey && config.projectId);
const app = firebaseConfigured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app
    ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
    : null;
export async function loginWithGoogle() {
    if (!auth)
        return;
    await signInWithPopup(auth, new GoogleAuthProvider());
}
export async function logout() {
    if (auth)
        await signOut(auth);
}

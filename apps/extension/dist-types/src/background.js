import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithCredential } from "firebase/auth/web-extension";
import { doc, getFirestore, runTransaction, serverTimestamp } from "firebase/firestore";
import { evolutionForLevel, levelFromXp, XP_BY_DIFFICULTY } from "@codekin/shared";
const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const configured = Boolean(config.apiKey && config.projectId);
const app = configured ? initializeApp(config) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
async function getQueue() {
    return (await chrome.storage.local.get("outbox")).outbox ?? [];
}
async function connect() {
    if (!auth)
        throw new Error("Firebase is not configured");
    const token = await chrome.identity.getAuthToken({ interactive: true });
    await signInWithCredential(auth, GoogleAuthProvider.credential(null, token.token));
    return auth.currentUser;
}
async function flush() {
    if (!db || !auth?.currentUser || !navigator.onLine)
        return;
    const queue = await getQueue();
    if (!queue.length)
        return;
    const uid = auth.currentUser.uid;
    const remaining = [...queue];
    for (const problem of queue) {
        const problemRef = doc(db, "users", uid, "problems", problem.slug);
        const progressRef = doc(db, "users", uid, "private", "progress");
        await runTransaction(db, async (tx) => {
            const [existingProblem, progressDoc] = await Promise.all([tx.get(problemRef), tx.get(progressRef)]);
            if (existingProblem.data()?.status === "solved")
                return;
            const current = progressDoc.data();
            const xp = (current?.companion?.xp ?? 0) + XP_BY_DIFFICULTY[problem.difficulty];
            const level = levelFromXp(xp);
            tx.set(problemRef, { ...problem, syncedAt: serverTimestamp() }, { merge: true });
            tx.set(progressRef, {
                totalSolved: (current?.totalSolved ?? 0) + 1,
                currentStreak: current?.currentStreak ?? 1,
                longestStreak: current?.longestStreak ?? 1,
                weeklySolved: (current?.weeklySolved ?? 0) + 1,
                weeklyGoal: current?.weeklyGoal ?? 7,
                lastSolvedAt: problem.solvedAt,
                companion: { ...(current?.companion ?? { mood: "happy", cosmetics: [] }), xp, level, evolution: evolutionForLevel(level), mood: "excited" },
                updatedAt: serverTimestamp(),
            }, { merge: true });
        });
        remaining.shift();
        await chrome.storage.local.set({ outbox: remaining });
    }
    await chrome.storage.local.set({ lastSync: new Date().toISOString() });
}
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === "CONNECT")
        connect().then((u) => respond({ ok: true, name: u?.displayName })).catch((e) => respond({ ok: false, error: e.message }));
    if (message.type === "QUEUE_SOLVE")
        getQueue().then(async (queue) => { if (!queue.some((x) => x.slug === message.problem.slug))
            queue.push(message.problem); await chrome.storage.local.set({ outbox: queue }); await flush(); respond({ ok: true }); });
    if (message.type === "FLUSH")
        flush().then(() => respond({ ok: true })).catch((e) => respond({ ok: false, error: e.message }));
    return true;
});
chrome.alarms.create("sync-outbox", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === "sync-outbox")
    void flush(); });
chrome.runtime.onInstalled.addListener(() => chrome.storage.local.set({ blindMode: true }));

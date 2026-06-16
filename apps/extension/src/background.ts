import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithCredential } from "firebase/auth/web-extension";
import { doc, getDoc, getFirestore, serverTimestamp, writeBatch } from "firebase/firestore";
import { evolutionForLevel, levelFromXp, XP_BY_DIFFICULTY, type Difficulty, type ProblemRecord, type UserProgress } from "@codekin/shared";

// ── Firebase init ──────────────────────────────────────────────────────────────
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const configured = Boolean(config.apiKey && config.projectId);
const app = configured ? initializeApp(config) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

// ── Queue helpers ──────────────────────────────────────────────────────────────
async function getQueue(): Promise<ProblemRecord[]> {
  return (await chrome.storage.local.get("outbox")).outbox ?? [];
}

// ── LeetCode GraphQL helper ────────────────────────────────────────────────────
async function leetcodeGql(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`LeetCode API returned ${res.status}`);
  return res.json();
}

// ── Fetch real difficulty + topics for a single slug ───────────────────────────
async function fetchProblemMeta(slug: string): Promise<{ difficulty: Difficulty; topics: string[] } | null> {
  try {
    const data = await leetcodeGql(
      `query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          difficulty
          topicTags { name }
        }
      }`,
      { titleSlug: slug },
    ) as { data?: { question?: { difficulty?: string; topicTags?: { name: string }[] } } };
    const q = data?.data?.question;
    if (!q?.difficulty) return null;
    return {
      difficulty: q.difficulty as Difficulty,
      topics: (q.topicTags ?? []).map((t) => t.name),
    };
  } catch {
    return null;
  }
}

// ── Batch-fetch metadata with rate limiting ────────────────────────────────────
async function batchFetchMeta(slugs: string[]): Promise<Map<string, { difficulty: Difficulty; topics: string[] }>> {
  const results = new Map<string, { difficulty: Difficulty; topics: string[] }>();
  const batchSize = 5;
  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);
    const fetches = batch.map(async (slug) => {
      const meta = await fetchProblemMeta(slug);
      if (meta) results.set(slug, meta);
    });
    await Promise.allSettled(fetches);
    if (i + batchSize < slugs.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return results;
}

// ── Auth ────────────────────────────────────────────────────────────────────────
async function connect() {
  if (!auth) throw new Error("Firebase is not configured");
  const clientId = chrome.runtime.getManifest().oauth2?.client_id ?? "";
  if (!clientId || clientId.includes("REPLACE_WITH")) throw new Error("Chrome OAuth client ID is not configured");
  const token = await chrome.identity.getAuthToken({ interactive: true });
  await signInWithCredential(auth, GoogleAuthProvider.credential(null, token.token));
  await auth.authStateReady();
  return auth.currentUser;
}

async function getStatus() {
  if (auth) await auth.authStateReady();
  const clientId = chrome.runtime.getManifest().oauth2?.client_id ?? "";
  const storage = await chrome.storage.local.get(["outbox", "lastSync"]);
  return {
    firebaseConfigured: configured,
    oauthConfigured: Boolean(clientId && !clientId.includes("REPLACE_WITH")),
    connected: Boolean(auth?.currentUser),
    name: auth?.currentUser?.displayName,
    queueDepth: (storage.outbox ?? []).length,
    lastSync: storage.lastSync ?? null,
  };
}

// ── Flush: write queued items to Firestore with per-item tracking ──────────────
interface FlushResult {
  written: number;
  skipped: number;
  failed: string[];
  status: "empty" | "written" | "skipped" | "offline" | "not_connected";
}

async function flush(): Promise<FlushResult> {
  const result: FlushResult = { written: 0, skipped: 0, failed: [], status: "empty" };
  if (!db || !auth) return { ...result, status: "not_connected" };
  await auth.authStateReady();
  if (!auth.currentUser) return { ...result, status: "not_connected" };

  const queue = await getQueue();
  if (!queue.length) return result;

  const uid = auth.currentUser.uid;
  const surviving: ProblemRecord[] = [];

  if (!navigator.onLine) {
    return { ...result, status: "offline" };
  }

  try {
    const existingChecks = await Promise.all(
      queue.map((problem) => getDoc(doc(db, "users", uid, "problems", problem.slug)))
    );

    const pending = queue.filter((problem, index) => {
      const existing = existingChecks[index];
      return !existing.exists() || existing.data()?.status !== "solved";
    });

    result.skipped = queue.length - pending.length;

    if (!pending.length) {
      await chrome.storage.local.set({ outbox: [] });
      result.status = "skipped";
      return result;
    }

    const progressRef = doc(db, "users", uid, "private", "progress");
    const progressDoc = await getDoc(progressRef);
    const current = progressDoc.data() as UserProgress | undefined;

    const nextXp = (current?.companion?.xp ?? 0) + pending.reduce((sum, problem) => sum + XP_BY_DIFFICULTY[problem.difficulty], 0);
    const level = levelFromXp(nextXp);

    const batch = writeBatch(db);
    for (const problem of pending) {
      const problemRef = doc(db, "users", uid, "problems", problem.slug);
      batch.set(problemRef, { ...problem, syncedAt: serverTimestamp() }, { merge: true });
    }

    batch.set(progressRef, {
      totalSolved: (current?.totalSolved ?? 0) + pending.length,
      currentStreak: current?.currentStreak ?? 1,
      longestStreak: current?.longestStreak ?? 1,
      weeklySolved: (current?.weeklySolved ?? 0) + pending.length,
      weeklyGoal: current?.weeklyGoal ?? 7,
      lastSolvedAt: pending[pending.length - 1]?.solvedAt ?? null,
      companion: {
        ...(current?.companion ?? { mood: "happy", unlockedCosmetics: [], equippedCosmetics: {} }),
        xp: nextXp,
        level,
        evolution: evolutionForLevel(level),
        mood: "excited",
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await batch.commit();
    result.written = pending.length;
    result.status = "written";
    await chrome.storage.local.set({ outbox: [] });
    await chrome.storage.local.set({ lastSync: new Date().toISOString() });
    return result;
  } catch (error) {
    result.failed = queue.map((problem) => problem.slug);
    result.status = "skipped";
    await chrome.storage.local.set({ outbox: queue });
    console.error("Flush failed", error);
    return result;
  }
}

// ── History sync: single reliable path ─────────────────────────────────────────
interface SyncResult {
  fetched: number;
  queued: number;
  alreadyKnown: number;
  metadataFetched: number;
  flushed: number;
  status: "queued_locally" | "written_to_firestore";
  errors: string[];
}

async function syncHistory(): Promise<SyncResult> {
  const result: SyncResult = { fetched: 0, queued: 0, alreadyKnown: 0, metadataFetched: 0, flushed: 0, status: "queued_locally", errors: [] };

  // Rate-limit: skip if synced within 1 hour unless forced
  const state = await chrome.storage.local.get(["lastHistorySync", "forceHistorySync"]);
  const lastSync = state.lastHistorySync ? new Date(state.lastHistorySync).getTime() : 0;
  const oneHourMs = 60 * 60 * 1000;
  if (!state.forceHistorySync && lastSync && (Date.now() - lastSync) < oneHourMs) {
    return result;
  }

  // Step 1: Get LeetCode username
  const userData = await leetcodeGql("{ userStatus { username } }") as {
    data?: { userStatus?: { username?: string } };
  };
  const username = userData?.data?.userStatus?.username;
  if (!username) {
    result.errors.push("Not logged into LeetCode — open leetcode.com and sign in first");
    return result;
  }

  // Step 2: Fetch recent accepted submissions
  const subData = await leetcodeGql(
    `query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id title titleSlug timestamp
      }
    }`,
    { username, limit: 200 },
  ) as { data?: { recentAcSubmissionList?: { id: string; title: string; titleSlug: string; timestamp: string }[] } };

  const submissions = subData?.data?.recentAcSubmissionList ?? [];
  result.fetched = submissions.length;
  if (!submissions.length) {
    result.errors.push("No accepted submissions found on LeetCode");
    return result;
  }

  // Step 3: Determine which are new
  const queue = await getQueue();
  const existingSlugs = new Set(queue.map((p) => p.slug));
  const newSubs = submissions.filter((s) => !existingSlugs.has(s.titleSlug));
  result.alreadyKnown = submissions.length - newSubs.length;

  if (!newSubs.length) {
    await chrome.storage.local.set({ lastHistorySync: new Date().toISOString(), forceHistorySync: false });
    return result;
  }

  // Step 4: Batch-fetch real metadata for new submissions
  const metaMap = await batchFetchMeta(newSubs.map((s) => s.titleSlug));
  result.metadataFetched = metaMap.size;

  // Step 5: Build problem records with real or fallback metadata
  for (const sub of newSubs) {
    const meta = metaMap.get(sub.titleSlug);
    queue.push({
      slug: sub.titleSlug,
      title: sub.title,
      difficulty: meta?.difficulty ?? "Medium",
      topics: meta?.topics ?? [],
      status: "solved",
      solvedAt: new Date(parseInt(sub.timestamp) * 1000).toISOString(),
      source: "extension",
      metadataSource: meta ? "leetcode" : "inferred",
    });
    result.queued++;
  }

  await chrome.storage.local.set({ outbox: queue, lastHistorySync: new Date().toISOString(), forceHistorySync: false });

  // Step 6: Immediately flush to Firestore
  if (db && auth?.currentUser) {
    const flushResult = await flush();
    result.flushed = flushResult.written;
    result.status = flushResult.written > 0 ? "written_to_firestore" : "queued_locally";
  } else {
    result.errors.push("Connect Google account to upload history to Firestore.");
    result.status = "queued_locally";
  }

  return result;
}

// ── Message handlers ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === "GET_STATUS") {
    getStatus().then(respond).catch((e) => respond({ error: e.message }));
  }

  if (message.type === "CONNECT") {
    connect()
      .then(async (u) => {
        let syncResult: SyncResult | undefined;
        try {
          syncResult = await syncHistory();
        } catch (e) {
          syncResult = { fetched: 0, queued: 0, alreadyKnown: 0, metadataFetched: 0, flushed: 0, status: "queued_locally", errors: [(e as Error).message] };
        }
        respond({ ok: true, name: u?.displayName, sync: syncResult });
      })
      .catch((e) => respond({ ok: false, error: e.message }));
  }

  if (message.type === "SYNC_HISTORY") {
    chrome.storage.local.set({ forceHistorySync: true }).then(() =>
      syncHistory()
        .then((r) => respond({ ok: true, ...r }))
        .catch((e) => respond({ ok: false, errors: [e.message], fetched: 0, queued: 0, alreadyKnown: 0, metadataFetched: 0, flushed: 0, status: "queued_locally" }))
    );
  }

  if (message.type === "QUEUE_SOLVE") {
    getQueue().then(async (queue) => {
      if (!queue.some((x) => x.slug === message.problem.slug)) {
        queue.push(message.problem);
      }
      await chrome.storage.local.set({ outbox: queue });
      const flushResult = await flush();
      respond({ ok: true, flush: flushResult });
    });
  }

  if (message.type === "FLUSH") {
    flush()
      .then((r) => respond({ ok: true, ...r }))
      .catch((e) => respond({ ok: false, error: e.message, written: 0, skipped: 0, failed: [] }));
  }

  return true;
});

// ── Periodic flush + install setup ─────────────────────────────────────────────
chrome.alarms.create("sync-outbox", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync-outbox") void flush();
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ blindMode: true });
});

import { useEffect, useRef, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { emptyProgress } from "@codekin/shared";
import { db } from "./firebase";
// Rough estimates for topic totals (used to compute mastery %)
const TOPIC_ESTIMATES = {
    "Array": 50, "String": 40, "Hash Table": 30, "Dynamic Programming": 50,
    "Math": 25, "Sorting": 20, "Greedy": 25, "Depth-First Search": 30,
    "Binary Search": 20, "Tree": 30, "Breadth-First Search": 20,
    "Two Pointers": 20, "Stack": 15, "Linked List": 20, "Graph": 25,
    "Backtracking": 15, "Sliding Window": 15, "Heap (Priority Queue)": 15,
    "Bit Manipulation": 15, "Recursion": 15, "Design": 15,
};
const DEFAULT_ESTIMATE = 20;
export function useProgress(uid) {
    const [progress, setProgress] = useState(emptyProgress);
    const [recent, setRecent] = useState([]);
    const [allProblems, setAllProblems] = useState([]);
    const [roadmap, setRoadmap] = useState([]);
    const [weakTopic, setWeakTopic] = useState("Binary Search");
    const [live, setLive] = useState(false);
    const [loading, setLoading] = useState(Boolean(uid));
    const [error, setError] = useState(null);
    // Guard: only write streak reset once per session
    const streakResetWritten = useRef(false);
    useEffect(() => {
        setProgress(emptyProgress);
        setRecent([]);
        setAllProblems([]);
        setRoadmap([]);
        setLive(false);
        setError(null);
        streakResetWritten.current = false;
        if (!db || !uid) {
            setLoading(false);
            return;
        }
        setLoading(true);
        // ── Listen to progress document ──────────────────────────────────────────
        const progressRef = doc(db, "users", uid, "private", "progress");
        const unsubscribeProgress = onSnapshot(progressRef, (snapshot) => {
            const data = snapshot.exists() ? snapshot.data() : emptyProgress;
            setProgress(data);
            setLive(!snapshot.metadata.fromCache);
            setLoading(false);
            // Streak midnight reset: persist to Firestore
            if (data.lastSolvedAt && data.currentStreak > 0 && !streakResetWritten.current) {
                const lastSolved = new Date(data.lastSolvedAt);
                const now = new Date();
                const lastDate = new Date(lastSolved.getFullYear(), lastSolved.getMonth(), lastSolved.getDate());
                const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const diffDays = Math.floor((nowDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays > 1) {
                    streakResetWritten.current = true;
                    updateDoc(progressRef, { currentStreak: 0 }).catch(console.error);
                }
            }
        }, (err) => { setError(err.message); setLoading(false); });
        // ── Listen to recent problems (top 20 for display + topic analysis) ──────
        const recentQuery = query(collection(db, "users", uid, "problems"), orderBy("solvedAt", "desc"), limit(20));
        const unsubscribeRecent = onSnapshot(recentQuery, (snapshot) => {
            const docs = snapshot.docs.map((d) => d.data());
            setRecent(docs.slice(0, 5));
            setAllProblems(docs);
            // Compute weak topic from all fetched problems
            if (docs.length > 0) {
                const counts = new Map();
                docs.forEach((d) => d.topics.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
                if (counts.size > 0) {
                    const sorted = [...counts.entries()].sort((a, b) => a[1] - b[1]);
                    setWeakTopic(sorted[0][0]);
                }
            }
            // Compute roadmap from topic distribution
            const topicCounts = new Map();
            docs.forEach((d) => d.topics.forEach((t) => topicCounts.set(t, (topicCounts.get(t) || 0) + 1)));
            if (topicCounts.size > 0) {
                const roadmapData = [...topicCounts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([topic, solved]) => ({
                    topicId: topic,
                    solved,
                    score: Math.min(100, Math.round((solved / (TOPIC_ESTIMATES[topic] || DEFAULT_ESTIMATE)) * 100)),
                }));
                setRoadmap(roadmapData);
            }
            else {
                setRoadmap([]);
            }
        }, (err) => setError(err.message));
        return () => { unsubscribeProgress(); unsubscribeRecent(); };
    }, [uid]); // Only uid — no progress.totalSolved to avoid infinite loops
    return { progress, recent, roadmap, weakTopic, live, loading, error };
}

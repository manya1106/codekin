import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./popup.css";
function Popup() {
    const [blind, setBlind] = useState(true);
    const [appState, setAppState] = useState("checking");
    const [statusText, setStatusText] = useState("Checking setup...");
    const [detailText, setDetailText] = useState("");
    const [userName, setUserName] = useState(null);
    const [queueDepth, setQueueDepth] = useState(0);
    const [lastSync, setLastSync] = useState(null);
    // Load initial state
    useEffect(() => {
        chrome.storage.local.get(["blindMode", "outbox", "lastSync"]).then((v) => {
            setBlind(v.blindMode !== false);
            setQueueDepth(v.outbox?.length ?? 0);
            setLastSync(v.lastSync ?? null);
        });
        chrome.runtime.sendMessage({ type: "GET_STATUS" }, (result) => {
            if (!result?.firebaseConfigured) {
                setAppState("unconfigured");
                setStatusText("Firebase environment is missing");
            }
            else if (!result?.oauthConfigured) {
                setAppState("unconfigured");
                setStatusText("Chrome OAuth client ID is missing");
            }
            else if (result.connected) {
                setAppState("connected");
                setUserName(result.name ?? null);
                setStatusText(`Connected as ${result.name?.split(" ")[0] ?? "coder"}`);
                setQueueDepth(result.queueDepth ?? 0);
                if (result.lastSync)
                    setLastSync(result.lastSync);
            }
            else {
                setAppState("ready");
                setStatusText("Connect to sync progress");
            }
        });
    }, []);
    const refreshQueue = () => {
        chrome.storage.local.get(["outbox", "lastSync"]).then((v) => {
            setQueueDepth(v.outbox?.length ?? 0);
            if (v.lastSync)
                setLastSync(v.lastSync);
        });
    };
    const toggle = async () => {
        const next = !blind;
        setBlind(next);
        await chrome.storage.local.set({ blindMode: next });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.id)
            chrome.tabs.reload(tab.id);
    };
    const connectGoogle = () => {
        setAppState("connecting");
        setStatusText("Connecting...");
        setDetailText("");
        chrome.runtime.sendMessage({ type: "CONNECT" }, (r) => {
            if (r?.ok) {
                setAppState("connected");
                setUserName(r.name ?? null);
                const sync = r.sync;
                if (sync && sync.fetched > 0) {
                    setStatusText(`Connected as ${r.name?.split(" ")[0] ?? "coder"}`);
                    if (sync.status === "written_to_firestore" && (sync.flushed ?? 0) > 0) {
                        setDetailText(`History: ${sync.fetched} found → ${sync.queued} queued and ${sync.flushed} written to Firestore (${sync.alreadyKnown} already known)`);
                    }
                    else if (sync.status === "queued_locally") {
                        setDetailText(`History: ${sync.fetched} found → ${sync.queued} queued locally; connect Google account to upload to Firestore (${sync.alreadyKnown} already known)`);
                    }
                    else {
                        setDetailText(`History: ${sync.fetched} found → ${sync.queued} queued (${sync.alreadyKnown} known)`);
                    }
                }
                else if (sync?.errors?.length) {
                    setStatusText(`Connected as ${r.name?.split(" ")[0] ?? "coder"}`);
                    setDetailText(`History: ${sync.errors[0]}`);
                }
                else {
                    setStatusText(`Connected as ${r.name?.split(" ")[0] ?? "coder"}`);
                }
                refreshQueue();
            }
            else {
                setAppState("error");
                setStatusText(r?.error ?? "Could not connect");
            }
        });
    };
    const doSyncHistory = () => {
        setAppState("syncing_history");
        setStatusText("Fetching LeetCode history...");
        setDetailText("");
        chrome.runtime.sendMessage({ type: "SYNC_HISTORY" }, (r) => {
            setAppState("connected");
            if (r?.ok) {
                const s = r;
                if (s.fetched === 0 && s.errors?.length) {
                    setStatusText("History sync failed");
                    setDetailText(s.errors[0]);
                }
                else if (s.status === "written_to_firestore" && (s.flushed ?? 0) > 0) {
                    setStatusText("History synced to Firestore");
                    setDetailText(`${s.fetched} found → ${s.queued} new, ${s.flushed} written to Firestore (${s.alreadyKnown} already known, ${s.metadataFetched} with real metadata)`);
                }
                else if (s.status === "queued_locally") {
                    setStatusText("History queued locally");
                    setDetailText(`${s.fetched} found → ${s.queued} new queued locally; connect Google account to upload to Firestore (${s.alreadyKnown} already known)`);
                }
                else {
                    setStatusText("History synced");
                    setDetailText(`${s.fetched} found → ${s.queued} new (${s.alreadyKnown} known, ${s.metadataFetched} with real metadata)`);
                }
            }
            else {
                setStatusText("History sync failed");
                setDetailText(r?.errors?.[0] ?? "Unknown error");
            }
            refreshQueue();
        });
    };
    const doFlush = () => {
        setAppState("flushing");
        setStatusText("Writing to Firestore...");
        setDetailText("");
        chrome.runtime.sendMessage({ type: "FLUSH" }, (r) => {
            setAppState("connected");
            if (r?.ok) {
                const f = r;
                if (f.status === "not_connected") {
                    setStatusText("Connect Google account first");
                    setDetailText("Firestore write is not available until you authenticate.");
                }
                else if (f.status === "offline") {
                    setStatusText("Firestore write paused");
                    setDetailText("You are offline; the queue will retry when the network returns.");
                }
                else if (f.status === "empty") {
                    setStatusText("Queue is empty");
                    setDetailText("Nothing to write to Firestore right now.");
                }
                else if (f.written > 0) {
                    setStatusText(`Written ${f.written} to Firestore`);
                    const parts = [];
                    if (f.skipped > 0)
                        parts.push(`${f.skipped} skipped (duplicates)`);
                    if (f.failed.length > 0)
                        parts.push(`${f.failed.length} failed — will retry`);
                    setDetailText(parts.join(", "));
                }
                else {
                    setStatusText("Flush completed with no new writes");
                    const parts = [];
                    if (f.skipped > 0)
                        parts.push(`${f.skipped} skipped (duplicates)`);
                    if (f.failed.length > 0)
                        parts.push(`${f.failed.length} failed — will retry`);
                    setDetailText(parts.join(", ") || "The queue is already up to date.");
                }
            }
            else {
                setStatusText("Flush failed");
                setDetailText(r?.error ?? "Unknown error");
            }
            refreshQueue();
        });
    };
    const isWorking = appState === "connecting" || appState === "syncing_history" || appState === "flushing";
    const isConnected = appState === "connected" || appState === "syncing_history" || appState === "flushing";
    return (_jsxs("main", { children: [_jsxs("header", { children: [_jsx("span", { className: "logo", children: "</>" }), _jsxs("div", { children: [_jsxs("h1", { children: ["code", _jsx("span", { children: "kin" })] }), _jsx("p", { children: statusText })] })] }), detailText && (_jsx("div", { style: { margin: "12px 0 0", padding: "10px 12px", background: "#111522", borderRadius: "10px", border: "1px solid #ffffff12", fontSize: "11px", color: "#a0aec0", lineHeight: 1.5 }, children: detailText })), _jsxs("section", { className: "buddy", children: [_jsx("div", { className: "face", children: "\u2022\u1D17\u2022" }), _jsxs("div", { children: [_jsx("b", { children: "Keep going!" }), _jsx("p", { children: "Every accepted solve is tracked and synced." })] })] }), _jsxs("section", { className: "setting", children: [_jsxs("div", { children: [_jsx("b", { children: "Blind mode" }), _jsx("p", { children: "Hide difficulty spoilers" })] }), _jsx("button", { onClick: toggle, className: blind ? "on" : "", children: _jsx("i", {}) })] }), _jsxs("div", { className: "sync", children: [_jsxs("span", { children: [queueDepth, " pending"] }), _jsxs("div", { style: { display: "flex", gap: "8px" }, children: [_jsx("button", { onClick: doFlush, disabled: isWorking || queueDepth === 0, children: appState === "flushing" ? "Writing..." : "Flush" }), isConnected && (_jsx("button", { onClick: doSyncHistory, disabled: isWorking, children: appState === "syncing_history" ? "Syncing..." : "Sync history" }))] })] }), _jsx("button", { className: "connect", disabled: appState !== "ready" || isConnected, onClick: connectGoogle, children: isConnected ? "Google account connected" : appState === "connecting" ? "Connecting..." : "Connect Google account" }), _jsxs("div", { style: { marginTop: "14px", padding: "10px 0 0", borderTop: "1px solid #ffffff0c", fontSize: "10px", color: "#556", lineHeight: 1.7 }, children: [_jsxs("div", { children: ["Queue: ", queueDepth, " items"] }), _jsxs("div", { children: ["Last Firestore write: ", lastSync ? new Date(lastSync).toLocaleString() : "never"] }), _jsxs("div", { children: ["Auth: ", userName ? `${userName}` : "not connected"] })] })] }));
}
createRoot(document.getElementById("root")).render(_jsx(Popup, {}));

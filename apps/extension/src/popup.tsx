import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./popup.css";

type AppState = "checking" | "unconfigured" | "ready" | "connecting" | "connected" | "syncing_history" | "flushing" | "error";

interface SyncResult {
  fetched: number;
  queued: number;
  alreadyKnown: number;
  metadataFetched: number;
  flushed?: number;
  repaired?: number;
  status?: "queued_locally" | "written_to_firestore";
  errors: string[];
}

function formatSyncDetail(sync: SyncResult) {
  const repairText = sync.repaired ? `, ${sync.repaired} metadata repaired` : "";
  if (sync.status === "written_to_firestore" && (sync.flushed ?? 0) > 0) {
    return `History: ${sync.fetched} found → ${sync.queued} queued and ${sync.flushed} written to Firestore (${sync.alreadyKnown} already known, ${sync.metadataFetched} with real metadata${repairText})`;
  }
  if (sync.status === "queued_locally") {
    return `History: ${sync.fetched} found → ${sync.queued} queued locally (${sync.alreadyKnown} already known, ${sync.metadataFetched} with real metadata${repairText})`;
  }
  return `History: ${sync.fetched} found → ${sync.queued} new (${sync.alreadyKnown} known, ${sync.metadataFetched} with real metadata${repairText})`;
}

interface FlushResult {
  written: number;
  skipped: number;
  failed: string[];
  status?: "empty" | "written" | "skipped" | "offline" | "not_connected";
}

function Popup() {
  const [blind, setBlind] = useState(true);
  const [appState, setAppState] = useState<AppState>("checking");
  const [statusText, setStatusText] = useState("Checking setup...");
  const [detailText, setDetailText] = useState("");
  const [userName, setUserName] = useState<string | null>(null);
  const [queueDepth, setQueueDepth] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);

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
      } else if (!result?.oauthConfigured) {
        setAppState("unconfigured");
        setStatusText("Chrome OAuth client ID is missing");
      } else if (result.connected) {
        setAppState("connected");
        setUserName(result.name ?? null);
        setStatusText(`Connected as ${result.name?.split(" ")[0] ?? "coder"}`);
        setQueueDepth(result.queueDepth ?? 0);
        if (result.lastSync) setLastSync(result.lastSync);
      } else {
        setAppState("ready");
        setStatusText("Connect to sync progress");
      }
    });
  }, []);

  const refreshQueue = () => {
    chrome.storage.local.get(["outbox", "lastSync"]).then((v) => {
      setQueueDepth(v.outbox?.length ?? 0);
      if (v.lastSync) setLastSync(v.lastSync);
    });
  };

  const toggle = async () => {
    const next = !blind;
    setBlind(next);
    await chrome.storage.local.set({ blindMode: next });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) chrome.tabs.reload(tab.id);
  };

  const connectGoogle = () => {
    setAppState("connecting");
    setStatusText("Connecting...");
    setDetailText("");
    chrome.runtime.sendMessage({ type: "CONNECT" }, (r) => {
      if (r?.ok) {
        setAppState("connected");
        setUserName(r.name ?? null);
        const sync = r.sync as SyncResult | undefined;
        if (sync && sync.fetched > 0) {
          setStatusText(`Connected as ${r.name?.split(" ")[0] ?? "coder"}`);
          setDetailText(formatSyncDetail(sync));
        } else if (sync?.errors?.length) {
          setStatusText(`Connected as ${r.name?.split(" ")[0] ?? "coder"}`);
          setDetailText(`History: ${sync.errors[0]}`);
        } else {
          setStatusText(`Connected as ${r.name?.split(" ")[0] ?? "coder"}`);
        }
        refreshQueue();
      } else {
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
        const s = r as SyncResult & { ok: boolean };
        if (s.fetched === 0 && s.errors?.length) {
          setStatusText("History sync failed");
          setDetailText(s.errors[0]);
        } else if (s.status === "written_to_firestore" && (s.flushed ?? 0) > 0) {
          setStatusText("History synced to Firestore");
          setDetailText(formatSyncDetail(s));
        } else if (s.status === "queued_locally") {
          setStatusText("History queued locally");
          setDetailText(formatSyncDetail(s));
        } else {
          setStatusText("History synced");
          setDetailText(formatSyncDetail(s));
        }
      } else {
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
        const f = r as FlushResult & { ok: boolean };
        if (f.status === "not_connected") {
          setStatusText("Connect Google account first");
          setDetailText("Firestore write is not available until you authenticate.");
        } else if (f.status === "offline") {
          setStatusText("Firestore write paused");
          setDetailText("You are offline; the queue will retry when the network returns.");
        } else if (f.status === "empty") {
          setStatusText("Queue is empty");
          setDetailText("Nothing to write to Firestore right now.");
        } else if (f.written > 0) {
          setStatusText(`Written ${f.written} to Firestore`);
          const parts: string[] = [];
          if (f.skipped > 0) parts.push(`${f.skipped} skipped (duplicates)`);
          if (f.failed.length > 0) parts.push(`${f.failed.length} failed — will retry`);
          setDetailText(parts.join(", "));
        } else {
          setStatusText("Flush completed with no new writes");
          const parts: string[] = [];
          if (f.skipped > 0) parts.push(`${f.skipped} skipped (duplicates)`);
          if (f.failed.length > 0) parts.push(`${f.failed.length} failed — will retry`);
          setDetailText(parts.join(", ") || "The queue is already up to date.");
        }
      } else {
        setStatusText("Flush failed");
        setDetailText(r?.error ?? "Unknown error");
      }
      refreshQueue();
    });
  };

  const isWorking = appState === "connecting" || appState === "syncing_history" || appState === "flushing";
  const isConnected = appState === "connected" || appState === "syncing_history" || appState === "flushing";

  return (
    <main>
      <header>
        <span className="logo">&lt;/&gt;</span>
        <div>
          <h1>code<span>kin</span></h1>
          <p>{statusText}</p>
        </div>
      </header>

      {detailText && (
        <div style={{ margin: "12px 0 0", padding: "10px 12px", background: "#111522", borderRadius: "10px", border: "1px solid #ffffff12", fontSize: "11px", color: "#a0aec0", lineHeight: 1.5 }}>
          {detailText}
        </div>
      )}

      <section className="buddy">
        <div className="face">•ᴗ•</div>
        <div>
          <b>Keep going!</b>
          <p>Every accepted solve is tracked and synced.</p>
        </div>
      </section>

      <section className="setting">
        <div>
          <b>Blind mode</b>
          <p>Hide difficulty spoilers</p>
        </div>
        <button onClick={toggle} className={blind ? "on" : ""}>
          <i />
        </button>
      </section>

      <div className="sync">
        <span>{queueDepth} pending</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={doFlush} disabled={isWorking || queueDepth === 0}>
            {appState === "flushing" ? "Writing..." : "Flush"}
          </button>
          {isConnected && (
            <button onClick={doSyncHistory} disabled={isWorking}>
              {appState === "syncing_history" ? "Syncing..." : "Sync history"}
            </button>
          )}
        </div>
      </div>

      <button
        className="connect"
        disabled={appState !== "ready" || isConnected}
        onClick={connectGoogle}
      >
        {isConnected ? "Google account connected" : appState === "connecting" ? "Connecting..." : "Connect Google account"}
      </button>

      {/* Diagnostic footer */}
      <div style={{ marginTop: "14px", padding: "10px 0 0", borderTop: "1px solid #ffffff0c", fontSize: "10px", color: "#556", lineHeight: 1.7 }}>
        <div>Queue: {queueDepth} items</div>
        <div>Last Firestore write: {lastSync ? new Date(lastSync).toLocaleString() : "never"}</div>
        <div>Auth: {userName ? `${userName}` : "not connected"}</div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);

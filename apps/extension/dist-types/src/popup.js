import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./popup.css";
function Popup() {
    const [blind, setBlind] = useState(true);
    const [pending, setPending] = useState(0);
    const [status, setStatus] = useState("Ready to focus");
    useEffect(() => { chrome.storage.local.get(["blindMode", "outbox", "lastSync"]).then((v) => { setBlind(v.blindMode !== false); setPending(v.outbox?.length ?? 0); if (v.lastSync)
        setStatus("Synced recently"); }); }, []);
    const toggle = async () => { const next = !blind; setBlind(next); await chrome.storage.local.set({ blindMode: next }); const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (tab.id)
        chrome.tabs.reload(tab.id); };
    const connect = () => chrome.runtime.sendMessage({ type: "CONNECT" }, (r) => setStatus(r?.ok ? `Hi, ${r.name?.split(" ")[0] ?? "coder"}!` : r?.error ?? "Could not connect"));
    return _jsxs("main", { children: [_jsxs("header", { children: [_jsx("span", { className: "logo", children: "</>" }), _jsxs("div", { children: [_jsxs("h1", { children: ["code", _jsx("span", { children: "kin" })] }), _jsx("p", { children: status })] })] }), _jsxs("section", { className: "buddy", children: [_jsx("div", { className: "face", children: "\u2022\u1D17\u2022" }), _jsxs("div", { children: [_jsx("b", { children: "Keep going!" }), _jsx("p", { children: "Every attempt makes you sharper." })] })] }), _jsxs("section", { className: "setting", children: [_jsxs("div", { children: [_jsx("b", { children: "Blind mode" }), _jsx("p", { children: "Hide spoilers until you attempt" })] }), _jsx("button", { onClick: toggle, className: blind ? "on" : "", children: _jsx("i", {}) })] }), _jsxs("div", { className: "sync", children: [_jsxs("span", { children: [pending, " pending sync"] }), _jsx("button", { onClick: () => chrome.runtime.sendMessage({ type: "FLUSH" }), children: "Sync now" })] }), _jsx("button", { className: "connect", onClick: connect, children: "Connect Google account" })] });
}
createRoot(document.getElementById("root")).render(_jsx(Popup, {}));

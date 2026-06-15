import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./popup.css";

function Popup() {
  const [blind, setBlind] = useState(true); const [pending, setPending] = useState(0); const [status, setStatus] = useState("Ready to focus");
  useEffect(()=>{chrome.storage.local.get(["blindMode","outbox","lastSync"]).then((v)=>{setBlind(v.blindMode!==false);setPending(v.outbox?.length??0);if(v.lastSync)setStatus("Synced recently");});},[]);
  const toggle=async()=>{const next=!blind;setBlind(next);await chrome.storage.local.set({blindMode:next});const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(tab.id)chrome.tabs.reload(tab.id);};
  const connect=()=>chrome.runtime.sendMessage({type:"CONNECT"},(r)=>setStatus(r?.ok?`Hi, ${r.name?.split(" ")[0]??"coder"}!`:r?.error??"Could not connect"));
  return <main><header><span className="logo">&lt;/&gt;</span><div><h1>code<span>kin</span></h1><p>{status}</p></div></header><section className="buddy"><div className="face">•ᴗ•</div><div><b>Keep going!</b><p>Every attempt makes you sharper.</p></div></section><section className="setting"><div><b>Blind mode</b><p>Hide spoilers until you attempt</p></div><button onClick={toggle} className={blind?"on":""}><i/></button></section><div className="sync"><span>{pending} pending sync</span><button onClick={()=>chrome.runtime.sendMessage({type:"FLUSH"})}>Sync now</button></div><button className="connect" onClick={connect}>Connect Google account</button></main>;
}
createRoot(document.getElementById("root")!).render(<Popup/>);

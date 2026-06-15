import type { Difficulty, ProblemRecord } from "@codekin/shared";

const STYLE_ID = "codekin-blind-mode";
const hiddenSelectors = [
  "[data-difficulty]", "a[href*='/tag/']", "a[href*='/company/']", "[class*='acceptance']",
  "[class*='difficulty']", "[class*='editorial']", "[class*='hint']",
];

async function attempted(slug: string) { return Boolean((await chrome.storage.local.get(`attempted:${slug}`))[`attempted:${slug}`]); }
function slug() { return location.pathname.split("/").filter(Boolean)[1] ?? "unknown"; }

async function applyBlindMode() {
  const state = await chrome.storage.local.get("blindMode");
  if (state.blindMode === false || await attempted(slug())) return;
  const style = document.createElement("style"); style.id = STYLE_ID;
  style.textContent = `${hiddenSelectors.join(",")} { filter: blur(8px) !important; opacity:.18 !important; pointer-events:none !important; user-select:none !important; transition:.25s !important; }`;
  document.head.appendChild(style);
}

function reveal() { document.getElementById(STYLE_ID)?.remove(); void chrome.storage.local.set({ [`attempted:${slug()}`]: true }); }

function inferDifficulty(): Difficulty {
  const text = document.body.innerText;
  if (/\bHard\b/.test(text)) return "Hard"; if (/\bMedium\b/.test(text)) return "Medium"; return "Easy";
}

function mountWidget() {
  const host = document.createElement("div"); host.id = "codekin-widget";
  host.innerHTML = `<style>#codekin-widget{position:fixed;right:20px;bottom:22px;z-index:2147483647;font-family:Inter,system-ui;color:#f7f8fb}#ck-card{display:flex;align-items:center;gap:12px;max-width:310px;padding:12px 14px;border:1px solid #ffffff20;border-radius:17px;background:#111522ee;box-shadow:0 15px 45px #0008;backdrop-filter:blur(14px)}#ck-face{display:grid;place-items:center;width:42px;height:38px;border-radius:48% 52% 44% 46%;background:#b9f46b;color:#111522;font-weight:900;font-size:12px}#ck-copy{font-size:12px;line-height:1.45}#ck-copy b{color:#b9f46b}#ck-close{border:0;background:transparent;color:#778;cursor:pointer;padding:2px}</style><div id="ck-card"><div id="ck-face">•ᴗ•</div><div id="ck-copy">Focus mode is on. <b>You&apos;ve got this.</b></div><button id="ck-close">×</button></div>`;
  document.documentElement.appendChild(host); host.querySelector("#ck-close")?.addEventListener("click", () => host.remove());
}

function watchSubmissions() {
  const seen = new Set<string>(); let submissionPending = false;
  document.addEventListener("click", (event) => {
    const button = (event.target as Element).closest("button");
    const label = button?.textContent?.trim();
    if (label === "Run" || label === "Run Code" || label === "Submit") reveal();
    if (label === "Submit") submissionPending = true;
  }, true);
  new MutationObserver((mutations) => {
    if (!submissionPending) return;
    const changedText = mutations.map((mutation) => {
      if (mutation.type === "characterData") return mutation.target.textContent ?? "";
      return [...mutation.addedNodes].map((node) => node.textContent ?? "").join(" ");
    }).join(" ");
    const result = /\b(Accepted|Wrong Answer|Time Limit Exceeded|Runtime Error|Compile Error)\b/.exec(changedText)?.[1];
    if (!result) return;
    reveal(); submissionPending = false;
    if (result !== "Accepted" || seen.has(slug())) return;
    seen.add(slug());
    const title = document.querySelector("a[href^='/problems/']")?.textContent?.replace(/^\d+\.\s*/, "").trim() || document.title.split(" - ")[0];
    const problem: ProblemRecord = { slug: slug(), title, difficulty: inferDifficulty(), topics: [], status: "solved", solvedAt: new Date().toISOString(), source: "extension" };
    void chrome.runtime.sendMessage({ type: "QUEUE_SOLVE", problem });
    const copy = document.querySelector("#ck-copy"); if (copy) copy.innerHTML = `Accepted! <b>Nice work, +XP earned.</b>`;
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

void applyBlindMode(); mountWidget(); watchSubmissions();

import type { Difficulty, ProblemRecord } from "@codekin/shared";

// ── Blind-mode selectors: precise, LeetCode-specific only ──────────────────────
const STYLE_ID = "codekin-blind-mode";

const hiddenSelectors = [
  // Problem detail page
  "[data-difficulty]",
  'div[class*="text-difficulty"]',
  'span[class*="text-difficulty"]',
  // Problem list table: colored difficulty text
  'td > span.text-olive',
  'td > span.text-yellow',
  'td > span.text-pink',
  // Some LeetCode layouts use these for Easy/Medium/Hard colors
  'td > span.text-lime-600',
  'td > span.text-yellow-500',
  'td > span.text-red-500',
];

// ── State helpers ──────────────────────────────────────────────────────────────
async function isBlindModeEnabled(): Promise<boolean> {
  const state = await chrome.storage.local.get("blindMode");
  return state.blindMode !== false;
}

async function attempted(slug: string): Promise<boolean> {
  return Boolean((await chrome.storage.local.get(`attempted:${slug}`))[`attempted:${slug}`]);
}

function currentSlug(): string {
  return location.pathname.split("/").filter(Boolean)[1] ?? "unknown";
}

function isOnProblemPage(): boolean {
  return /^\/problems\/[^/]+/.test(location.pathname);
}

// ── Blind mode ─────────────────────────────────────────────────────────────────
async function applyBlindMode() {
  if (!await isBlindModeEnabled()) return;
  // On problem pages, skip if already attempted
  if (isOnProblemPage() && await attempted(currentSlug())) return;

  // Remove any existing style first
  document.getElementById(STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `${hiddenSelectors.join(",")} {
    filter: blur(8px) !important;
    opacity: .18 !important;
    pointer-events: none !important;
    user-select: none !important;
    transition: .25s !important;
  }`;
  document.head.appendChild(style);
}

function reveal() {
  document.getElementById(STYLE_ID)?.remove();
  if (isOnProblemPage()) {
    void chrome.storage.local.set({ [`attempted:${currentSlug()}`]: true });
  }
}

// ── Difficulty inference (for submission capture on problem pages) ──────────────
function inferDifficulty(): Difficulty {
  const text = document.body.innerText;
  if (/\bHard\b/.test(text)) return "Hard";
  if (/\bMedium\b/.test(text)) return "Medium";
  return "Easy";
}

// ── Companion widget (only on problem pages) ───────────────────────────────────
function mountWidget() {
  if (document.getElementById("codekin-widget")) return; // already mounted
  const host = document.createElement("div");
  host.id = "codekin-widget";
  host.innerHTML = `<style>#codekin-widget{position:fixed;right:20px;bottom:22px;z-index:2147483647;font-family:Inter,system-ui;color:#f7f8fb}#ck-card{display:flex;align-items:center;gap:12px;max-width:310px;padding:12px 14px;border:1px solid #ffffff20;border-radius:17px;background:#111522ee;box-shadow:0 15px 45px #0008;backdrop-filter:blur(14px)}#ck-face{display:grid;place-items:center;width:42px;height:38px;border-radius:48% 52% 44% 46%;background:#b9f46b;color:#111522;font-weight:900;font-size:12px}#ck-copy{font-size:12px;line-height:1.45}#ck-copy b{color:#b9f46b}#ck-close{border:0;background:transparent;color:#778;cursor:pointer;padding:2px}</style><div id="ck-card"><div id="ck-face">•ᴗ•</div><div id="ck-copy">Focus mode is on. <b>You&apos;ve got this.</b></div><button id="ck-close">×</button></div>`;
  document.documentElement.appendChild(host);
  host.querySelector("#ck-close")?.addEventListener("click", () => host.remove());
}

// ── Submission watcher (only on problem pages) ─────────────────────────────────
function watchSubmissions() {
  const seen = new Set<string>();
  let submissionPending = false;

  document.addEventListener("click", (event) => {
    const button = (event.target as Element).closest("button");
    const label = button?.textContent?.trim();
    if (label === "Run" || label === "Run Code" || label === "Submit") reveal();
    if (label === "Submit") submissionPending = true;
  }, true);

  new MutationObserver((mutations) => {
    if (!submissionPending) return;
    const changedText = mutations
      .map((m) => {
        if (m.type === "characterData") return m.target.textContent ?? "";
        return [...m.addedNodes].map((n) => n.textContent ?? "").join(" ");
      })
      .join(" ");
    const result = /\b(Accepted|Wrong Answer|Time Limit Exceeded|Runtime Error|Compile Error)\b/.exec(changedText)?.[1];
    if (!result) return;
    reveal();
    submissionPending = false;
    if (result !== "Accepted" || seen.has(currentSlug())) return;
    seen.add(currentSlug());
    const title =
      document.querySelector("a[href^='/problems/']")?.textContent?.replace(/^\d+\.\s*/, "").trim() ||
      document.title.split(" - ")[0];
    const problem: ProblemRecord = {
      slug: currentSlug(),
      title,
      difficulty: inferDifficulty(),
      topics: [],
      status: "solved",
      solvedAt: new Date().toISOString(),
      source: "extension",
      metadataSource: "inferred",
    };
    void chrome.runtime.sendMessage({ type: "QUEUE_SOLVE", problem });
    const copy = document.querySelector("#ck-copy");
    if (copy) copy.innerHTML = `Accepted! <b>Nice work, +XP earned.</b>`;
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

// ── SPA navigation: re-apply blind mode when LeetCode navigates ────────────────
let lastPath = location.pathname;

function handleNavigation() {
  if (location.pathname === lastPath) return;
  lastPath = location.pathname;
  // Re-apply blind mode on every navigation
  void applyBlindMode();
  // Mount/unmount widget based on page type
  if (isOnProblemPage()) {
    mountWidget();
  } else {
    document.getElementById("codekin-widget")?.remove();
  }
}

// Watch for SPA navigations via URL changes
new MutationObserver(handleNavigation).observe(document.querySelector("head > title") ?? document.head, {
  childList: true,
  subtree: true,
  characterData: true,
});

// Also intercept History API pushState/replaceState
const originalPush = history.pushState.bind(history);
const originalReplace = history.replaceState.bind(history);
history.pushState = (...args) => { originalPush(...args); handleNavigation(); };
history.replaceState = (...args) => { originalReplace(...args); handleNavigation(); };
window.addEventListener("popstate", handleNavigation);

// ── Initial setup ──────────────────────────────────────────────────────────────
void applyBlindMode();
if (isOnProblemPage()) {
  mountWidget();
  watchSubmissions();
}

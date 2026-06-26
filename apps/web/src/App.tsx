import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { motion } from "framer-motion";
import {
  Activity, Award, BarChart3, BookOpen, BrainCircuit, ChevronRight, CircleUserRound,
  Flame, Github, Home, LogIn, Map, Menu, Settings, Sparkles, Target, Wifi, WifiOff, X, Bell, HelpCircle
} from "lucide-react";
import { XP_BY_DIFFICULTY, xpToNextLevel, getDynamicMood, type ProblemRecord, type RoadmapProgress, type CompanionState } from "@codekin/shared";
import { auth, firebaseConfigured, loginWithGoogle, logout, requestNotificationPermission, type NotificationResult } from "./firebase";
import { useProgress } from "./useProgress";

type Page = "Dashboard" | "Challenge" | "Roadmap" | "Quiz" | "Insights";
const nav: { label: Page; icon: typeof Home }[] = [
  { label: "Dashboard", icon: Home }, { label: "Challenge", icon: BrainCircuit },
  { label: "Roadmap", icon: Map }, { label: "Quiz", icon: HelpCircle }, { label: "Insights", icon: BarChart3 },
];

function Companion({ companion, remaining, currentStreak }: { companion: CompanionState; remaining: number; currentStreak: number }) {
  const step = xpToNextLevel(companion.xp);
  const hour = new Date().getHours();
  const activeMood = getDynamicMood(currentStreak, hour);

  return <div className="glass pixel-grid relative overflow-hidden rounded-[28px] p-6 md:p-8">
    <div className="absolute right-5 top-5 rounded-full border border-lime/20 bg-lime/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-lime">{activeMood}</div>
    <div className="relative z-10 flex flex-col items-center gap-4 md:flex-row md:gap-10">
      <motion.div animate={{ y: [0, -8, 0], rotate: [0, 1, -1, 0] }} transition={{ duration: 3.5, repeat: Infinity }} className="shrink-0 py-5 relative">
        <div className="blob">
          {companion.equippedCosmetics?.hat === "hat_crown" && <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl">👑</div>}
          {companion.equippedCosmetics?.accessory === "acc_glasses" && <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xl">👓</div>}
          <div className="antenna"/><div className="mouth"/>
        </div>
      </motion.div>
      <div className="w-full">
        <p className="mb-2 font-mono text-xs uppercase tracking-[.22em] text-lime">Level {companion.level} · {companion.evolution}</p>
        <h2 className="max-w-xl text-2xl font-bold leading-tight md:text-3xl">{remaining > 0 ? <>Hey, coder! You&apos;re <span className="text-lime">{remaining} {remaining === 1 ? "problem" : "problems"}</span> away from your weekly goal.</> : <>Weekly goal complete. <span className="text-lime">Beautiful work!</span></>}</h2>
        <p className="mt-3 text-sm text-slate-400">{companion.xp === 0 ? "Solve a problem with the extension connected to earn your first XP." : "Your synchronized progress is shaping your companion."}</p>
        <div className="mt-6 max-w-lg">
          <div className="mb-2 flex justify-between font-mono text-[11px] text-slate-400"><span>{step.current} XP</span><span>{step.required} XP to level {companion.level + 1}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, step.current / step.required * 100)}%` }} className="h-full rounded-full bg-gradient-to-r from-lime to-cyan" /></div>
        </div>
      </div>
    </div>
  </div>;
}

function Stat({ icon: Icon, value, label, detail, color }: { icon: typeof Flame; value: string | number; label: string; detail: string; color: string }) {
  return <motion.div whileHover={{ y: -3 }} className="glass rounded-2xl p-5">
    <div className="flex items-start justify-between"><div><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div><div className={`rounded-xl p-2.5 ${color}`}><Icon size={20}/></div></div>
    <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-slate-500">{detail}</p>
  </motion.div>;
}

function relativeTime(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function topicSummary(problems: ProblemRecord[]) {
  const counts = new globalThis.Map<string, number>();
  problems.flatMap((problem) => problem.topics).forEach((topic) => counts.set(topic, (counts.get(topic) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
}

// Dashboard receives all data as props — no internal useProgress call
interface DashboardProps {
  progress: import("@codekin/shared").UserProgress;
  recent: ProblemRecord[];
  live: boolean;
  online: boolean;
  loading: boolean;
  error: string | null;
  uid?: string;
}

function Dashboard({ progress, recent, live, online, loading, error, uid }: DashboardProps) {
  const topics = topicSummary(recent);
  const remaining = Math.max(0, progress.weeklyGoal - progress.weeklySolved);
  const dateLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const syncLabel = !uid
    ? "Sign in to sync"
    : loading
      ? "Loading progress"
      : live
        ? "Live Firestore data"
        : online
          ? "Online, using cached data"
          : "Offline / cached";
  return <div className="space-y-6">
    <div className="flex items-end justify-between"><div><p className="font-mono text-xs uppercase tracking-[.25em] text-violet">{dateLabel}</p><h1 className="mt-2 text-3xl font-bold md:text-4xl">Ready to level up?</h1></div><span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">{online ? <Wifi size={14}/> : <WifiOff size={14}/>} {syncLabel}</span></div>
    {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">Firestore could not load your progress: {error}</div>}
    {uid && !loading && progress.totalSolved === 0 && <div className="rounded-xl border border-cyan/20 bg-cyan/10 px-4 py-3 text-sm text-cyan">No synchronized solves yet. Connect the extension with this same Google account, then submit an accepted LeetCode solution.</div>}
    <Companion companion={progress.companion} remaining={remaining} currentStreak={progress.currentStreak}/>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={BookOpen} value={progress.totalSolved} label="Problems synced" detail="Tracked by Codekin" color="bg-violet/15 text-violet"/>
      <Stat icon={Flame} value={`${progress.currentStreak} days`} label="Current streak" detail={`Best: ${progress.longestStreak} days`} color="bg-orange-400/15 text-orange-300"/>
      <Stat icon={Target} value={`${progress.weeklySolved}/${progress.weeklyGoal}`} label="Weekly goal" detail={remaining ? `${remaining} more to complete` : "Goal complete"} color="bg-lime/15 text-lime"/>
      <Stat icon={Award} value={progress.companion.level} label="Companion level" detail={`${progress.companion.xp.toLocaleString()} total XP`} color="bg-cyan/15 text-cyan"/>
    </div>
    <div className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
      <section className="glass rounded-2xl p-5 md:p-6"><div className="flex items-center justify-between"><div><p className="font-semibold">Recent activity</p><p className="mt-1 text-xs text-slate-500">Your latest wins</p></div><Activity size={18} className="text-slate-500"/></div>
        <div className="mt-4 divide-y divide-white/5">{recent.length ? recent.map((item) => <div key={item.slug} className="flex items-center gap-3 py-4"><span className={`h-2 w-2 shrink-0 rounded-full ${item.difficulty === "Easy" ? "bg-lime" : item.difficulty === "Hard" ? "bg-red-300" : "bg-amber-300"}`}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.difficulty}{item.topics.length ? ` · ${item.topics.join(", ")}` : ""} · {relativeTime(item.solvedAt)}</p></div><span className="font-mono text-xs text-lime">+{XP_BY_DIFFICULTY[item.difficulty]} XP</span></div>) : <p className="py-8 text-center text-sm text-slate-500">Your synchronized accepted solutions will appear here.</p>}</div>
      </section>
      <section className="glass rounded-2xl p-5 md:p-6"><div className="flex items-center justify-between"><div><p className="font-semibold">Topic pulse</p><p className="mt-1 text-xs text-slate-500">Last 30 days</p></div><Sparkles size={18} className="text-violet"/></div>
        <div className="mt-6 space-y-5">{topics.length ? topics.map(([name, count], index) => <div key={name}><div className="mb-2 flex justify-between text-xs"><span>{name}</span><span className="font-mono text-slate-500">{count} solved</span></div><div className="h-1.5 rounded-full bg-white/5"><div className={`h-full rounded-full ${["bg-lime", "bg-violet", "bg-cyan"][index]}`} style={{width:`${Math.max(20, count / recent.length * 100)}%`}}/></div></div>) : <p className="py-8 text-center text-sm text-slate-500">Topic data will appear after synchronized solves include tags.</p>}</div>
        <button className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm text-slate-300 transition hover:bg-white/5">View full insights <ChevronRight size={15}/></button>
      </section>
    </div>
  </div>;
}

function Challenge({ weakTopic }: { weakTopic: string }) { return <div><p className="font-mono text-xs uppercase tracking-[.25em] text-violet">Personalized for you</p><h1 className="mt-2 text-4xl font-bold">Today&apos;s challenge</h1><div className="glass mt-8 overflow-hidden rounded-[28px] p-7 md:p-10"><span className="rounded-full bg-amber-300/10 px-3 py-1 font-mono text-xs text-amber-300">MEDIUM · +45 XP</span><h2 className="mt-6 text-3xl font-bold">Practice: {weakTopic}</h2><p className="mt-3 max-w-2xl text-slate-400">A focused problem picked because your recent history indicates this topic could use a little more practice.</p><div className="mt-8 flex flex-wrap gap-3"><span className="rounded-lg bg-white/5 px-3 py-2 text-xs">{weakTopic}</span></div><a href={`https://leetcode.com/tag/${weakTopic.toLowerCase().replace(/ /g, '-')}/`} target="_blank" rel="noreferrer" className="mt-10 inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-3 text-sm font-bold text-ink">Start challenge <ChevronRight size={17}/></a></div></div>; }

function Roadmap({ roadmap }: { roadmap: RoadmapProgress[] }) { return <div><p className="font-mono text-xs uppercase tracking-[.25em] text-violet">Your journey</p><h1 className="mt-2 text-4xl font-bold">Topic roadmaps</h1>{roadmap.length ? <div className="mt-8 grid gap-4 md:grid-cols-2">{roadmap.map((item)=><div className="glass rounded-2xl p-6" key={item.topicId}><div className="flex justify-between"><h2 className="font-semibold">{item.topicId}</h2><span className="font-mono text-xs text-slate-500">{item.solved} solved</span></div><div className="mt-5 h-2 rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-violet to-cyan" style={{width:`${item.score}%`}}/></div><p className="mt-3 text-xs text-slate-500">{Math.round(item.score)}% mastery</p></div>)}</div> : <p className="mt-8 text-slate-500">Topic roadmap data will populate as you solve problems with tagged topics.</p>}</div>; }

function Quiz({ weakTopic }: { weakTopic: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  return <div><p className="font-mono text-xs uppercase tracking-[.25em] text-violet">Knowledge Check</p><h1 className="mt-2 text-4xl font-bold">Mini Quiz: {weakTopic}</h1><div className="glass mt-8 rounded-[28px] p-7 md:p-10"><h2 className="text-2xl font-semibold">Which of the following is true about {weakTopic}?</h2><div className="mt-6 space-y-3">{["It runs in O(N log N) time on average.", "It requires an already sorted array.", "It uses a Queue data structure.", "It relies on dynamic programming."].map((opt, i)=><button key={i} onClick={()=>setSelected(i)} className={`w-full rounded-xl border p-4 text-left transition ${selected===i ? "border-lime bg-lime/10 text-lime" : "border-white/10 hover:bg-white/5"}`}>{opt}</button>)}</div>{selected !== null && <p className="mt-6 font-mono text-sm text-lime">Answer submitted!</p>}</div></div>;
}

export default function App() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [menu, setMenu] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  useEffect(() => auth ? onAuthStateChanged(auth, setUser) : undefined, []);

  // Single useProgress call at the top level — fixes the hooks violation
  const { progress, recent, roadmap, weakTopic, live, online, loading, error } = useProgress(user?.uid);

  const handlePushNotification = async () => {
    setPushStatus("Requesting...");
    const result = await requestNotificationPermission();
    setPushStatus(result.message);
    setTimeout(() => setPushStatus(null), 5000);
  };

  return <div className="relative min-h-screen"><div className="noise"/>
    <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-white/5 bg-ink/95 p-5 backdrop-blur-xl transition-transform lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between"><button onClick={()=>setPage("Dashboard")} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet font-mono font-bold text-white">&lt;/&gt;</span><span className="text-xl font-bold">code<span className="text-lime">kin</span></span></button><button className="lg:hidden" onClick={()=>setMenu(false)}><X size={20}/></button></div>
      <nav className="mt-12 space-y-2">{nav.map(({label,icon:Icon})=><button key={label} onClick={()=>{setPage(label);setMenu(false)}} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${page===label ? "bg-violet/15 text-white" : "text-slate-500 hover:bg-white/5 hover:text-slate-200"}`}><Icon size={18} className={page===label?"text-violet":""}/>{label}{label==="Challenge"&&<span className="ml-auto h-2 w-2 rounded-full bg-lime"/>}</button>)}</nav>
      <div className="absolute bottom-5 left-5 right-5"><div className="mb-4 border-t border-white/5 pt-4">
        <button onClick={handlePushNotification} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-500 hover:text-white"><Bell size={17}/>{pushStatus || "Enable Push"}</button>
        <button className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-500 hover:text-white"><Settings size={17}/>Settings</button>
      </div>{user ? <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left"><CircleUserRound size={28}/><span className="min-w-0"><span className="block truncate text-xs font-medium">{user.displayName}</span><span className="block text-[10px] text-slate-500">Sign out</span></span></button> : <button onClick={loginWithGoogle} disabled={!firebaseConfigured} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"><LogIn size={15}/>{firebaseConfigured?"Continue with Google":"Configure Firebase"}</button>}</div>
    </aside>
    <main className="relative z-10 min-h-screen lg:ml-64"><header className="flex h-16 items-center justify-between border-b border-white/5 px-5 lg:hidden"><button onClick={()=>setMenu(true)}><Menu/></button><span className="font-bold">code<span className="text-lime">kin</span></span><Github size={19} className="text-slate-500"/></header><div className="mx-auto max-w-7xl p-4 pb-24 md:p-8 lg:p-10">
      {page==="Dashboard"&&<Dashboard progress={progress} recent={recent} live={live} online={online} loading={loading} error={error} uid={user?.uid}/>}
      {page==="Challenge"&&<Challenge weakTopic={weakTopic}/>}
      {page==="Roadmap"&&<Roadmap roadmap={roadmap}/>}
      {page==="Quiz"&&<Quiz weakTopic={weakTopic}/>}
      {page==="Insights"&&<Roadmap roadmap={roadmap}/>}
    </div></main>
  </div>;
}

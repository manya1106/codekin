import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { motion } from "framer-motion";
import {
  Activity, Award, BarChart3, BookOpen, BrainCircuit, ChevronRight, CircleUserRound,
  Flame, Github, Home, LogIn, Map, Menu, Settings, Sparkles, Target, Wifi, WifiOff, X,
} from "lucide-react";
import { xpToNextLevel } from "@codekin/shared";
import { auth, firebaseConfigured, loginWithGoogle, logout } from "./firebase";
import { useProgress } from "./useProgress";

type Page = "Dashboard" | "Challenge" | "Roadmap" | "Insights";
const nav: { label: Page; icon: typeof Home }[] = [
  { label: "Dashboard", icon: Home }, { label: "Challenge", icon: BrainCircuit },
  { label: "Roadmap", icon: Map }, { label: "Insights", icon: BarChart3 },
];

const recent = [
  { title: "Longest Increasing Subsequence", meta: "Dynamic Programming", level: "Medium", xp: 45, time: "Today" },
  { title: "Search in Rotated Sorted Array", meta: "Binary Search", level: "Medium", xp: 45, time: "Yesterday" },
  { title: "Valid Parentheses", meta: "Stack", level: "Easy", xp: 20, time: "2 days ago" },
];

function Companion({ level, xp }: { level: number; xp: number }) {
  const step = xpToNextLevel(xp);
  return <div className="glass pixel-grid relative overflow-hidden rounded-[28px] p-6 md:p-8">
    <div className="absolute right-5 top-5 rounded-full border border-lime/20 bg-lime/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-lime">Happy</div>
    <div className="relative z-10 flex flex-col items-center gap-4 md:flex-row md:gap-10">
      <motion.div animate={{ y: [0, -8, 0], rotate: [0, 1, -1, 0] }} transition={{ duration: 3.5, repeat: Infinity }} className="shrink-0 py-5">
        <div className="blob"><div className="antenna"/><div className="mouth"/></div>
      </motion.div>
      <div className="w-full">
        <p className="mb-2 font-mono text-xs uppercase tracking-[.22em] text-lime">Level {level} · Tiny Blob</p>
        <h2 className="max-w-xl text-2xl font-bold leading-tight md:text-3xl">Hey, coder! You&apos;re only <span className="text-lime">2 problems</span> away from your weekly goal.</h2>
        <p className="mt-3 text-sm text-slate-400">Your consistency is looking sharp. Let&apos;s keep that streak glowing.</p>
        <div className="mt-6 max-w-lg">
          <div className="mb-2 flex justify-between font-mono text-[11px] text-slate-400"><span>{step.current} XP</span><span>{step.required} XP to level {level + 1}</span></div>
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

function Dashboard({ uid }: { uid?: string }) {
  const { progress, live } = useProgress(uid);
  return <div className="space-y-6">
    <div className="flex items-end justify-between"><div><p className="font-mono text-xs uppercase tracking-[.25em] text-violet">Monday, June 15</p><h1 className="mt-2 text-3xl font-bold md:text-4xl">Ready to level up?</h1></div><span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">{live ? <Wifi size={14}/> : <WifiOff size={14}/>} {live ? "Live sync" : "Demo / cached"}</span></div>
    <Companion level={progress.companion.level} xp={progress.companion.xp}/>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={BookOpen} value={progress.totalSolved} label="Problems solved" detail="Top 18% this month" color="bg-violet/15 text-violet"/>
      <Stat icon={Flame} value={`${progress.currentStreak} days`} label="Current streak" detail={`Best: ${progress.longestStreak} days`} color="bg-orange-400/15 text-orange-300"/>
      <Stat icon={Target} value={`${progress.weeklySolved}/${progress.weeklyGoal}`} label="Weekly goal" detail="2 more to complete" color="bg-lime/15 text-lime"/>
      <Stat icon={Award} value={progress.companion.level} label="Companion level" detail={`${progress.companion.xp.toLocaleString()} total XP`} color="bg-cyan/15 text-cyan"/>
    </div>
    <div className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
      <section className="glass rounded-2xl p-5 md:p-6"><div className="flex items-center justify-between"><div><p className="font-semibold">Recent activity</p><p className="mt-1 text-xs text-slate-500">Your latest wins</p></div><Activity size={18} className="text-slate-500"/></div>
        <div className="mt-4 divide-y divide-white/5">{recent.map((item) => <div key={item.title} className="flex items-center gap-3 py-4"><span className={`h-2 w-2 shrink-0 rounded-full ${item.level === "Easy" ? "bg-lime" : "bg-amber-300"}`}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.meta} · {item.time}</p></div><span className="font-mono text-xs text-lime">+{item.xp} XP</span></div>)}</div>
      </section>
      <section className="glass rounded-2xl p-5 md:p-6"><div className="flex items-center justify-between"><div><p className="font-semibold">Topic pulse</p><p className="mt-1 text-xs text-slate-500">Last 30 days</p></div><Sparkles size={18} className="text-violet"/></div>
        <div className="mt-6 space-y-5">{[["Arrays",82,"bg-lime"],["Dynamic Programming",64,"bg-violet"],["Binary Search",41,"bg-cyan"]].map(([name, score, color]) => <div key={String(name)}><div className="mb-2 flex justify-between text-xs"><span>{name}</span><span className="font-mono text-slate-500">{score}%</span></div><div className="h-1.5 rounded-full bg-white/5"><div className={`h-full rounded-full ${color}`} style={{width:`${score}%`}}/></div></div>)}</div>
        <button className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm text-slate-300 transition hover:bg-white/5">View full insights <ChevronRight size={15}/></button>
      </section>
    </div>
  </div>;
}

function Challenge() { return <div><p className="font-mono text-xs uppercase tracking-[.25em] text-violet">Personalized for you</p><h1 className="mt-2 text-4xl font-bold">Today&apos;s challenge</h1><div className="glass mt-8 overflow-hidden rounded-[28px] p-7 md:p-10"><span className="rounded-full bg-amber-300/10 px-3 py-1 font-mono text-xs text-amber-300">MEDIUM · +45 XP</span><h2 className="mt-6 text-3xl font-bold">Koko Eating Bananas</h2><p className="mt-3 max-w-2xl text-slate-400">A focused binary search problem picked because this topic needs a little more practice.</p><div className="mt-8 flex flex-wrap gap-3"><span className="rounded-lg bg-white/5 px-3 py-2 text-xs">Binary Search</span><span className="rounded-lg bg-white/5 px-3 py-2 text-xs">Arrays</span></div><a href="https://leetcode.com/problems/koko-eating-bananas/" target="_blank" rel="noreferrer" className="mt-10 inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-3 text-sm font-bold text-ink">Start challenge <ChevronRight size={17}/></a></div></div>; }

function Roadmap() { return <div><p className="font-mono text-xs uppercase tracking-[.25em] text-violet">Your journey</p><h1 className="mt-2 text-4xl font-bold">Topic roadmaps</h1><div className="mt-8 grid gap-4 md:grid-cols-2">{[["Data Structures","18 / 24",75],["Algorithms","11 / 20",55],["Dynamic Programming","7 / 18",39],["Graphs","4 / 16",25]].map(([name,count,score])=><div className="glass rounded-2xl p-6" key={String(name)}><div className="flex justify-between"><h2 className="font-semibold">{name}</h2><span className="font-mono text-xs text-slate-500">{count}</span></div><div className="mt-5 h-2 rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-violet to-cyan" style={{width:`${score}%`}}/></div><p className="mt-3 text-xs text-slate-500">{score}% complete</p></div>)}</div></div>; }

export default function App() {
  const [page, setPage] = useState<Page>("Dashboard"); const [menu, setMenu] = useState(false); const [user, setUser] = useState<User | null>(null);
  useEffect(() => auth ? onAuthStateChanged(auth, setUser) : undefined, []);
  return <div className="relative min-h-screen"><div className="noise"/>
    <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-white/5 bg-ink/95 p-5 backdrop-blur-xl transition-transform lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center justify-between"><button onClick={()=>setPage("Dashboard")} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet font-mono font-bold text-white">&lt;/&gt;</span><span className="text-xl font-bold">code<span className="text-lime">kin</span></span></button><button className="lg:hidden" onClick={()=>setMenu(false)}><X size={20}/></button></div>
      <nav className="mt-12 space-y-2">{nav.map(({label,icon:Icon})=><button key={label} onClick={()=>{setPage(label);setMenu(false)}} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${page===label ? "bg-violet/15 text-white" : "text-slate-500 hover:bg-white/5 hover:text-slate-200"}`}><Icon size={18} className={page===label?"text-violet":""}/>{label}{label==="Challenge"&&<span className="ml-auto h-2 w-2 rounded-full bg-lime"/>}</button>)}</nav>
      <div className="absolute bottom-5 left-5 right-5"><div className="mb-4 border-t border-white/5 pt-4"><button className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-500"><Settings size={17}/>Settings</button></div>{user ? <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left"><CircleUserRound size={28}/><span className="min-w-0"><span className="block truncate text-xs font-medium">{user.displayName}</span><span className="block text-[10px] text-slate-500">Sign out</span></span></button> : <button onClick={loginWithGoogle} disabled={!firebaseConfigured} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"><LogIn size={15}/>{firebaseConfigured?"Continue with Google":"Configure Firebase"}</button>}</div>
    </aside>
    <main className="relative z-10 min-h-screen lg:ml-64"><header className="flex h-16 items-center justify-between border-b border-white/5 px-5 lg:hidden"><button onClick={()=>setMenu(true)}><Menu/></button><span className="font-bold">code<span className="text-lime">kin</span></span><Github size={19} className="text-slate-500"/></header><div className="mx-auto max-w-7xl p-4 pb-24 md:p-8 lg:p-10">{page==="Dashboard"&&<Dashboard uid={user?.uid}/>} {page==="Challenge"&&<Challenge/>} {page==="Roadmap"&&<Roadmap/>} {page==="Insights"&&<Roadmap/>}</div></main>
  </div>;
}

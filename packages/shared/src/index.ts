export type Difficulty = "Easy" | "Medium" | "Hard";
export type CompanionMood = "happy" | "excited" | "focused" | "sleeping" | "motivating";

export interface ProblemRecord {
  slug: string;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  status: "attempted" | "solved";
  solvedAt: string;
  source: "extension" | "pwa";
}

export interface CompanionState {
  xp: number;
  level: number;
  mood: CompanionMood;
  evolution: string;
  cosmetics: string[];
}

export interface UserProgress {
  totalSolved: number;
  currentStreak: number;
  longestStreak: number;
  weeklySolved: number;
  weeklyGoal: number;
  lastSolvedAt: string | null;
  companion: CompanionState;
}

export const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  Easy: 20,
  Medium: 45,
  Hard: 90,
};

export function levelFromXp(xp: number) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

export function evolutionForLevel(level: number) {
  if (level >= 50) return "AI Dragon";
  if (level >= 25) return "Cyber Fox";
  if (level >= 10) return "Coding Cat";
  return "Tiny Blob";
}

export function xpToNextLevel(xp: number) {
  const level = levelFromXp(xp);
  const currentFloor = (level - 1) ** 2 * 50;
  const nextFloor = level ** 2 * 50;
  return {
    current: xp - currentFloor,
    required: nextFloor - currentFloor,
  };
}

export const demoProgress: UserProgress = {
  totalSolved: 127,
  currentStreak: 6,
  longestStreak: 14,
  weeklySolved: 5,
  weeklyGoal: 7,
  lastSolvedAt: new Date().toISOString(),
  companion: {
    xp: 4380,
    level: levelFromXp(4380),
    mood: "happy",
    evolution: evolutionForLevel(levelFromXp(4380)),
    cosmetics: ["Neon headphones"],
  },
};

export type Difficulty = "Easy" | "Medium" | "Hard";
export type CompanionMood = "happy" | "excited" | "focused" | "sleeping" | "motivating" | "sad" | "tired";

export interface ProblemRecord {
  slug: string;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  status: "attempted" | "solved";
  solvedAt: string;
  source: "extension" | "pwa";
  /** Whether difficulty/topics came from LeetCode or were filled with placeholders */
  metadataSource?: "leetcode" | "inferred";
}

export interface CosmeticItem {
  id: string;
  name: string;
  type: "hat" | "accessory" | "background";
  requiredLevel: number;
}

export const COSMETICS_CATALOG: CosmeticItem[] = [
  { id: "hat_crown", name: "Gold Crown", type: "hat", requiredLevel: 5 },
  { id: "acc_glasses", name: "Nerd Glasses", type: "accessory", requiredLevel: 10 },
  { id: "bg_matrix", name: "Matrix Hacker", type: "background", requiredLevel: 25 },
];

export interface CompanionState {
  xp: number;
  level: number;
  mood: CompanionMood;
  evolution: string;
  unlockedCosmetics: string[];
  equippedCosmetics: {
    hat?: string;
    accessory?: string;
    background?: string;
  };
}

export interface RoadmapTopic {
  id: string;
  name: string;
  totalProblems: number;
}

export interface RoadmapProgress {
  topicId: string;
  solved: number;
  score: number; // 0-100
}

export interface QuizQuestion {
  id: string;
  topicId: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface UserSettings {
  fcmToken?: string;
  blindMode: boolean;
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

export function unlockedCosmeticsForLevel(level: number): string[] {
  return COSMETICS_CATALOG.filter(c => level >= c.requiredLevel).map(c => c.id);
}

export function getDynamicMood(streak: number, hour: number): CompanionMood {
  if (hour >= 23 || hour < 6) return "sleeping";
  if (streak > 7) return "excited";
  if (streak > 0) return "focused";
  if (streak === 0 && hour > 20) return "tired";
  return "motivating";
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

export const emptyProgress: UserProgress = {
  totalSolved: 0,
  currentStreak: 0,
  longestStreak: 0,
  weeklySolved: 0,
  weeklyGoal: 7,
  lastSolvedAt: null,
  companion: {
    xp: 0,
    level: 1,
    mood: "motivating",
    evolution: "Tiny Blob",
    unlockedCosmetics: [],
    equippedCosmetics: {},
  },
};

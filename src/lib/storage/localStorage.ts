import type { ProgressMap, ProfileStats } from '../../types/progress';
import type { LocalProfile } from '../../types/settings';
import type { VocabProgressMap } from '../../types/vocab';

const KEYS = {
  profile: 'ofa-sat:profile',
  progress: 'ofa-sat:progress',
  stats: 'ofa-sat:stats',
  // Its own key: vocabulary is a separate section, and mixing the two maps would make
  // "reset my wrong questions" quietly wipe flashcard progress too.
  vocabProgress: 'ofa-sat:vocab-progress',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — fail silently, app still works in-memory
  }
}

export const DEFAULT_STATS: ProfileStats = {
  points: 0,
  questionsAttempted: 0,
  correctCount: 0,
  currentStreak: 0,
  bestStreak: 0,
};

export function getProfile(): LocalProfile | null {
  return read<LocalProfile | null>(KEYS.profile, null);
}

export function setProfile(profile: LocalProfile): void {
  write(KEYS.profile, profile);
}

export function getProgress(): ProgressMap {
  return read<ProgressMap>(KEYS.progress, {});
}

export function setProgress(progress: ProgressMap): void {
  write(KEYS.progress, progress);
}

export function getStats(): ProfileStats {
  return read<ProfileStats>(KEYS.stats, DEFAULT_STATS);
}

export function setStats(stats: ProfileStats): void {
  write(KEYS.stats, stats);
}

export function getVocabProgress(): VocabProgressMap {
  return read<VocabProgressMap>(KEYS.vocabProgress, {});
}

export function setVocabProgress(progress: VocabProgressMap): void {
  write(KEYS.vocabProgress, progress);
}

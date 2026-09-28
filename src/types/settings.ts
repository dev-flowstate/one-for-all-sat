export type RevealMode = 'immediate' | 'end';

export type TimerMode = 'countdown' | 'stopwatch' | 'none';

export interface SessionConfig {
  subjects: import('./question').Subject[];
  domains: string[];
  skills: string[];
  difficulties: import('./question').Difficulty[];
  questionCount: number;
  revealMode: RevealMode;
  timerMode: TimerMode;
  /** Minutes, only used when timerMode === 'countdown'. */
  countdownMinutes?: number;
}

export interface LocalProfile {
  nickname: string;
  avatar: string;
  createdAt: string;
  /** Signed-in users are on the leaderboard unless they turn this on. */
  hideFromLeaderboard?: boolean;
  /** The student's SAT date (YYYY-MM-DD), which the home screen counts down to. */
  satDate?: string;
}

export const DEFAULT_AVATARS = ['🦉', '📘', '🧮', '✏️', '🎯', '⭐', '🚀', '🧠'] as const;

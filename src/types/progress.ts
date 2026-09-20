export type AttemptOutcome = 'correct' | 'incorrect';

export interface QuestionStatus {
  status: 'unattempted' | 'correct' | 'incorrect';
  attempts: number;
  lastAttemptedAt?: string;
  lastOutcome?: AttemptOutcome;
}

/** questionId -> status, the single source of truth Main/Wrong/Right pools are derived from. */
export type ProgressMap = Record<string, QuestionStatus>;

export interface ProfileStats {
  points: number;
  questionsAttempted: number;
  correctCount: number;
  currentStreak: number;
  bestStreak: number;
}

export interface SessionAnswer {
  questionId: string;
  outcome: AttemptOutcome;
  selectedChoice?: string;
  submittedAnswer?: string;
  pointsEarned: number;
}

export interface SessionResult {
  completedAt: string;
  answers: SessionAnswer[];
  totalPoints: number;
  correctCount: number;
  incorrectCount: number;
}

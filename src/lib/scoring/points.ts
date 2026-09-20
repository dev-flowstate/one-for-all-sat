import type { Difficulty } from '../../types/question';

const BASE_POINTS: Record<Difficulty, number> = {
  Easy: 10,
  Medium: 15,
  Hard: 20,
};

const MAX_STREAK_BONUS = 10;

/** Points for one correct answer: a difficulty-scaled base plus a small streak bonus. Returns 0 if incorrect. */
export function pointsForAnswer(difficulty: Difficulty, correct: boolean, streakBeforeThisAnswer: number): number {
  if (!correct) return 0;
  const streakBonus = Math.min(streakBeforeThisAnswer, MAX_STREAK_BONUS);
  return BASE_POINTS[difficulty] + streakBonus;
}

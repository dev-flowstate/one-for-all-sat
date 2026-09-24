import type { Question } from '../types/question';
import type { ProgressMap } from '../types/progress';

export function statusOf(progress: ProgressMap, questionId: string): 'unattempted' | 'correct' | 'incorrect' {
  return progress[questionId]?.status ?? 'unattempted';
}

/** Unattempted questions, leaving out ones kept back for a named practice test. */
export function getMainPool(questions: Question[], progress: ProgressMap): Question[] {
  return questions.filter((q) => !q.testOnly && statusOf(progress, q.id) === 'unattempted');
}

export function getWrongPool(questions: Question[], progress: ProgressMap): Question[] {
  return questions.filter((q) => statusOf(progress, q.id) === 'incorrect');
}

export function getRightPool(questions: Question[], progress: ProgressMap): Question[] {
  return questions.filter((q) => statusOf(progress, q.id) === 'correct');
}

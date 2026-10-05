import type { QuestionMeta } from '../types/question';
import type { ProgressMap } from '../types/progress';

export function statusOf(progress: ProgressMap, questionId: string): 'unattempted' | 'correct' | 'incorrect' {
  return progress[questionId]?.status ?? 'unattempted';
}

/** Unattempted questions, leaving out ones kept back for a named practice test. */
export function getMainPool<Q extends QuestionMeta>(questions: Q[], progress: ProgressMap): Q[] {
  return questions.filter((q) => !q.testOnly && statusOf(progress, q.id) === 'unattempted');
}

export function getWrongPool<Q extends QuestionMeta>(questions: Q[], progress: ProgressMap): Q[] {
  return questions.filter((q) => statusOf(progress, q.id) === 'incorrect');
}

export function getRightPool<Q extends QuestionMeta>(questions: Q[], progress: ProgressMap): Q[] {
  return questions.filter((q) => statusOf(progress, q.id) === 'correct');
}

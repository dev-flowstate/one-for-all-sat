import { create } from 'zustand';
import type { Question, ChoiceId } from '../types/question';
import type { SessionConfig } from '../types/settings';
import type { AttemptOutcome, SessionAnswer, SessionResult } from '../types/progress';
import type { HighlightRange } from '../lib/highlighter/ranges';
import { pointsForAnswer } from '../lib/scoring/points';

interface SessionState {
  config: SessionConfig | null;
  queue: Question[];
  currentIndex: number;
  answers: Record<string, SessionAnswer>;
  crosserActive: boolean;
  crossedChoices: Record<string, ChoiceId[]>;
  /** Keyed by `${questionId}:${field}` so passage and prompt highlights don't collide. */
  highlights: Record<string, HighlightRange[]>;
  streak: number;
  startedAt: string | null;
  /** Set by finishSession(); survives clearSession() so ResultsPage can read it after the
   *  running session state (queue/answers/index) is reset. Cleared only by the next finishSession(). */
  lastResult: SessionResult | null;

  startSession: (config: SessionConfig, queue: Question[], initialStreak: number) => void;
  answerCurrent: (outcome: AttemptOutcome, selectedChoice?: string, submittedAnswer?: string) => void;
  goToIndex: (index: number) => void;
  toggleCrosser: () => void;
  toggleCrossedChoice: (questionId: string, choiceId: ChoiceId) => void;
  setHighlights: (key: string, ranges: HighlightRange[]) => void;
  /** Computes the result, stores it as lastResult, and returns it. Does NOT call
   *  useProgressStore.applySessionResult() itself — the caller (TestRunnerPage) must do that. */
  finishSession: () => SessionResult;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  config: null,
  queue: [],
  currentIndex: 0,
  answers: {},
  crosserActive: false,
  crossedChoices: {},
  highlights: {},
  streak: 0,
  startedAt: null,
  lastResult: null,

  startSession: (config, queue, initialStreak) => {
    set({
      config,
      queue,
      currentIndex: 0,
      answers: {},
      crosserActive: false,
      crossedChoices: {},
      highlights: {},
      streak: initialStreak,
      startedAt: new Date().toISOString(),
    });
  },

  answerCurrent: (outcome, selectedChoice, submittedAnswer) => {
    const { queue, currentIndex, streak, answers } = get();
    const question = queue[currentIndex];
    if (!question) return;
    const pointsEarned = pointsForAnswer(question.difficulty, outcome === 'correct', streak);
    const nextStreak = outcome === 'correct' ? streak + 1 : 0;
    set({
      answers: {
        ...answers,
        [question.id]: { questionId: question.id, outcome, selectedChoice, submittedAnswer, pointsEarned },
      },
      streak: nextStreak,
    });
  },

  goToIndex: (index) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    set({ currentIndex: index });
  },

  toggleCrosser: () => set((s) => ({ crosserActive: !s.crosserActive })),

  toggleCrossedChoice: (questionId, choiceId) => {
    const crossed = { ...get().crossedChoices };
    const current = new Set(crossed[questionId] ?? []);
    if (current.has(choiceId)) current.delete(choiceId);
    else current.add(choiceId);
    crossed[questionId] = Array.from(current);
    set({ crossedChoices: crossed });
  },

  setHighlights: (key, ranges) => {
    set((s) => ({ highlights: { ...s.highlights, [key]: ranges } }));
  },

  finishSession: () => {
    const list = Object.values(get().answers);
    const result: SessionResult = {
      completedAt: new Date().toISOString(),
      answers: list,
      totalPoints: list.reduce((sum, a) => sum + a.pointsEarned, 0),
      correctCount: list.filter((a) => a.outcome === 'correct').length,
      incorrectCount: list.filter((a) => a.outcome === 'incorrect').length,
    };
    set({ lastResult: result });
    return result;
  },

  clearSession: () => {
    set({
      config: null,
      queue: [],
      currentIndex: 0,
      answers: {},
      crosserActive: false,
      crossedChoices: {},
      highlights: {},
      streak: 0,
      startedAt: null,
    });
  },
}));

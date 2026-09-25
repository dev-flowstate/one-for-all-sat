import { create } from 'zustand';
import type { Question, ChoiceId } from '../types/question';
import type { SessionConfig } from '../types/settings';
import type { AttemptOutcome, SessionAnswer, SessionResult } from '../types/progress';
import type { HighlightRange } from '../lib/highlighter/ranges';
import { pointsForAnswer } from '../lib/scoring/points';
import { useProgressStore } from './useProgressStore';

interface SessionState {
  config: SessionConfig | null;
  queue: Question[];
  currentIndex: number;
  answers: Record<string, SessionAnswer>;
  crosserActive: boolean;
  /** Highlighter tool: selecting text or clicking a word highlights it straight away. */
  highlighterActive: boolean;
  /** What's been saved to progress for each question so far. With answers revealed at the
   *  end they can change until the set ends, and a saved one that changes is corrected. */
  committed: Record<string, { outcome: AttemptOutcome; points: number; streakBefore: number }>;
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
  /** Saves answers not yet saved, and corrects saved ones that have since changed: on
   *  finishing, leaving, the page being hidden or closed, or at once when revealed straight away. */
  commitPending: () => void;
  toggleCrosser: () => void;
  toggleHighlighter: () => void;
  toggleCrossedChoice: (questionId: string, choiceId: ChoiceId) => void;
  setHighlights: (key: string, ranges: HighlightRange[]) => void;
  /** Computes the result for the results screen, stores it as lastResult, and returns it.
   *  Progress is already saved by then: answerCurrent() records each answer as it's given. */
  finishSession: () => SessionResult;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  config: null,
  queue: [],
  currentIndex: 0,
  answers: {},
  crosserActive: false,
  highlighterActive: false,
  committed: {},
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
      highlighterActive: false,
      committed: {},
      crossedChoices: {},
      highlights: {},
      streak: initialStreak,
      startedAt: new Date().toISOString(),
    });
  },

  answerCurrent: (outcome, selectedChoice, submittedAnswer) => {
    const { queue, currentIndex, answers, committed, config } = get();
    const question = queue[currentIndex];
    if (!question) return;
    const changeable = config?.revealMode === 'end';
    // Shown right or wrong straight away, an answer is final.
    if (!changeable && committed[question.id]) return;
    // Points are worked out when the answer is saved, so a changed answer can't earn twice.
    const pointsEarned = answers[question.id]?.pointsEarned ?? 0;
    const answer: SessionAnswer = { questionId: question.id, outcome, selectedChoice, submittedAnswer, pointsEarned };
    set({ answers: { ...answers, [question.id]: answer } });
    // Revealed at the end, it can change until the set ends, and is saved then.
    if (!changeable) get().commitPending();
  },

  commitPending: () => {
    for (const question of get().queue) {
      const { answers, committed, streak } = get();
      const answer = answers[question.id];
      if (!answer) continue;
      const correct = answer.outcome === 'correct';
      const prior = committed[question.id];
      if (prior) {
        // Saved already, then changed: correct it rather than count it again. The streak it
        // was answered on stays, so later questions' points don't shift.
        if (prior.outcome === answer.outcome) continue;
        const points = pointsForAnswer(question.difficulty, correct, prior.streakBefore);
        useProgressStore.getState().amendAnswer(question.id, answer.outcome, points - prior.points);
        set({
          answers: { ...answers, [question.id]: { ...answer, pointsEarned: points } },
          committed: { ...committed, [question.id]: { ...prior, outcome: answer.outcome, points } },
        });
        continue;
      }
      const saved: SessionAnswer = { ...answer, pointsEarned: pointsForAnswer(question.difficulty, correct, streak) };
      set({
        answers: { ...answers, [question.id]: saved },
        committed: {
          ...committed,
          [question.id]: { outcome: answer.outcome, points: saved.pointsEarned, streakBefore: streak },
        },
        streak: correct ? streak + 1 : 0,
      });
      // Saved per answer, not when the set is finished, so leaving partway through (Exit, a
      // closed tab, a reload) keeps every question answered so far.
      useProgressStore.getState().applySessionResult({
        completedAt: new Date().toISOString(),
        answers: [saved],
        totalPoints: saved.pointsEarned,
        correctCount: correct ? 1 : 0,
        incorrectCount: correct ? 0 : 1,
      });
    }
  },

  goToIndex: (index) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    set({ currentIndex: index });
  },

  toggleCrosser: () => set((s) => ({ crosserActive: !s.crosserActive })),
  toggleHighlighter: () => set((s) => ({ highlighterActive: !s.highlighterActive })),

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
    get().commitPending();
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
      highlighterActive: false,
      committed: {},
      crossedChoices: {},
      highlights: {},
      streak: 0,
      startedAt: null,
    });
  },
}));

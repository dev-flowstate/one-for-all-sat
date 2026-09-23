import { create } from 'zustand';
import type { Question } from '../types/question';
import type { ActiveTest, CompletedTest, TestModule, TestResponse } from '../types/practiceTest';
import { getActiveTest, getTestHistory, setActiveTest, setTestHistory } from '../lib/storage/localStorage';
import { BREAK_MINUTES } from '../lib/practiceTest/buildTest';
import { gradeTest } from '../lib/practiceTest/score';
import { useProgressStore } from './useProgressStore';

interface PracticeTestState {
  active: ActiveTest | null;
  history: CompletedTest[];
  /** The number of the test that just ended, so the runner knows whose results to open. */
  justFinished: number | null;
  /** Set when a module's clock ran out and submitted it, so the runner can say why it moved on. */
  timedOut: boolean;

  begin: (modules: TestModule[], timed: boolean) => void;
  respond: (questionId: string, response: TestResponse | null) => void;
  toggleMarked: (questionId: string) => void;
  goTo: (index: number) => void;
  showReview: () => void;
  /** Runs the clock down. A module whose time runs out is submitted as it stands. */
  tick: (seconds: number) => void;
  /** Ends the current module and moves on: to module 2, the break, Math, or the results. */
  submitModule: () => void;
  endBreak: () => void;
  discard: () => void;
  dismissTimedOut: () => void;
}

// Tests saved before the untimed option existed were all timed.
const savedTest = getActiveTest();
const savedHistory = getTestHistory().map((t) => ({ ...t, timed: t.timed ?? true }));

/** The section break sits between the last Reading and Writing module and the first Math one. */
const MODULE_BEFORE_BREAK = 1;

export const usePracticeTestStore = create<PracticeTestState>((set, get) => {
  function update(change: Partial<ActiveTest>) {
    const { active } = get();
    if (active) set({ active: { ...active, ...change } });
  }

  function startModule(index: number) {
    const { active } = get();
    if (!active) return;
    update({
      stage: { kind: 'module', module: index, view: 'question' },
      currentIndex: 0,
      secondsLeft: active.modules[index].minutes * 60,
    });
  }

  function finish() {
    const { active, history } = get();
    if (!active) return;
    const progress = useProgressStore.getState();
    // Grading needs the bank. The runner holds the clock until it's loaded, so this is only a
    // backstop against grading every question as missing.
    if (!progress.isLoaded) return;
    const byId = new Map<string, Question>(progress.questions.map((q) => [q.id, q]));
    const result = gradeTest(active, byId, progress.stats.currentStreak);
    // The same bookkeeping a drill does: wrong answers move to the Wrong tab, right ones to Right.
    progress.applySessionResult({
      completedAt: result.completedAt,
      answers: result.answers,
      totalPoints: result.answers.reduce((sum, a) => sum + a.pointsEarned, 0),
      correctCount: result.answers.filter((a) => a.outcome === 'correct').length,
      incorrectCount: result.answers.filter((a) => a.outcome === 'incorrect').length,
    });
    set({ active: null, history: [...history, result], justFinished: result.number });
  }

  return {
    // Read straight away rather than from an effect: a reload lands on the runner, and for its
    // first render to find the test, the test has to be there before anything renders.
    active: savedTest && { ...savedTest, timed: savedTest.timed ?? true },
    history: savedHistory,
    justFinished: null,
    timedOut: false,

    begin: (modules, timed) => {
      set({
        justFinished: null,
        timedOut: false,
        active: {
          // Numbered by finished tests, so a discarded test doesn't leave a gap.
          number: get().history.length + 1,
          createdAt: new Date().toISOString(),
          timed,
          modules,
          stage: { kind: 'module', module: 0, view: 'question' },
          currentIndex: 0,
          responses: {},
          marked: [],
          secondsLeft: modules[0].minutes * 60,
        },
      });
    },

    respond: (questionId, response) => {
      const { active } = get();
      if (!active) return;
      const responses = { ...active.responses };
      if (response) responses[questionId] = response;
      else delete responses[questionId];
      update({ responses });
    },

    toggleMarked: (questionId) => {
      const { active } = get();
      if (!active) return;
      const marked = active.marked.includes(questionId)
        ? active.marked.filter((id) => id !== questionId)
        : [...active.marked, questionId];
      update({ marked });
    },

    goTo: (index) => {
      const { active } = get();
      if (!active || active.stage.kind !== 'module') return;
      update({ currentIndex: index, stage: { ...active.stage, view: 'question' } });
    },

    showReview: () => {
      const { active } = get();
      if (!active || active.stage.kind !== 'module') return;
      update({ stage: { ...active.stage, view: 'review' } });
    },

    tick: (seconds) => {
      const { active } = get();
      if (!active || !active.timed || active.secondsLeft === 0) return;
      const secondsLeft = Math.max(0, active.secondsLeft - seconds);
      update({ secondsLeft });
      if (secondsLeft === 0 && active.stage.kind === 'module') {
        set({ timedOut: true });
        get().submitModule();
      }
    },

    submitModule: () => {
      const { active } = get();
      if (!active || active.stage.kind !== 'module') return;
      const next = active.stage.module + 1;
      if (next >= active.modules.length) finish();
      else if (active.stage.module === MODULE_BEFORE_BREAK) {
        update({ stage: { kind: 'break' }, secondsLeft: BREAK_MINUTES * 60 });
      } else startModule(next);
    },

    endBreak: () => startModule(MODULE_BEFORE_BREAK + 1),

    discard: () => set({ active: null }),

    dismissTimedOut: () => set({ timedOut: false }),
  };
});

// Saved on every change rather than at checkpoints, so a closed tab or a reload resumes on
// the same question with the same answers and time left.
usePracticeTestStore.subscribe((state, previous) => {
  if (state.active !== previous.active) setActiveTest(state.active);
  if (state.history !== previous.history) setTestHistory(state.history);
});

import type { ChoiceId, Subject } from './question';
import type { SessionAnswer } from './progress';

export interface TestModule {
  subject: Subject;
  /** Module 1 or 2 of its section. */
  number: 1 | 2;
  minutes: number;
  questionIds: string[];
}

/** What's been entered for a question so far. Nothing is graded until the test ends, so an
 *  answer can be changed as often as you like while its module is open. */
export interface TestResponse {
  choice?: ChoiceId;
  text?: string;
}

/**
 * Adaptive routing, as on the real test: how a module goes decides which version of the next
 * one is given. The next module's questions start as the harder version; answering fewer than
 * `minCorrect` right in module `afterModule` swaps in `easierIds`.
 */
export interface TestRouting {
  afterModule: number;
  minCorrect: number;
  easierIds: string[];
  /** Set once decided: true when the easier version was given. */
  routedEasier?: boolean;
}

export type TestStage =
  | { kind: 'module'; module: number; view: 'question' | 'review' }
  | { kind: 'break' };

/** A test in progress. Saved on every change, so closing the tab loses nothing. */
export interface ActiveTest {
  /** Unique within the history; the results page's address. */
  number: number;
  /** What the test is called: "Practice Test 3", or a named test's title. Older saved tests
   *  have none and are called by their number. */
  name?: string;
  /** Set for a named test with fixed questions, e.g. one made for a particular student. */
  presetId?: string;
  routing?: TestRouting;
  createdAt: string;
  /** Untimed tests have no module clocks and no break countdown. */
  timed: boolean;
  modules: TestModule[];
  stage: TestStage;
  /** Position within the current module. */
  currentIndex: number;
  responses: Record<string, TestResponse>;
  /** Question ids flagged with "Mark for review". */
  marked: string[];
  /** What's left on the running clock, the module's or the break's. Stored as a count rather
   *  than a deadline so the clock doesn't run while the site is closed. Unused when untimed. */
  secondsLeft: number;
}

export interface DomainTally {
  subject: Subject;
  domain: string;
  total: number;
  wrong: number;
}

export interface CompletedTest {
  number: number;
  name?: string;
  presetId?: string;
  /** For an adaptive test: whether the easier version of the routed module was given. */
  routedEasier?: boolean;
  createdAt: string;
  completedAt: string;
  timed: boolean;
  /** A section's score, or null when the test didn't include that section. */
  readingWriting: number | null;
  math: number | null;
  /** Out of 1600, only when the test had both sections. */
  total: number | null;
  /** Every question in test order. A question left blank counts as incorrect, as on the SAT. */
  answers: SessionAnswer[];
  domains: DomainTally[];
}
